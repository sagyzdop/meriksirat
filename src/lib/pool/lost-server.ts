import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, flamekeeper, photo, user, volume } from '@/db/schema'
import { type Budget } from '@/lib/cron/budget'
import { formatLongDate } from '@/lib/club-time'
import { albumRecountSet } from '@/lib/albums/expiry'
import { DriveNotFoundError, shareWithWriter } from '@/lib/google/google-drive'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import { sendEmail } from '@/lib/google/email'
import {
  invalidateCachedDetailCore,
  invalidateCachedListing,
} from '@/lib/albums/server'
import { LOST_GRACE_MS, RESTORE_BATCH, planRecovery } from './health'
import { notifyAlbumTombstoned, ownerTelegramChat } from './notices'
import { planRecoveryShare } from './volumes'
import { volumeHasPhotoRows } from './volumes-server'
import { chunk } from '@/lib/utils'
import { adjustUsedBytes, IN_CHUNK, type HealthEnv } from './health-shared'

const MAX_EMAILS_PER_RUN = 3
const MAX_FINALIZE_VOLUMES_PER_RUN = 10
const RECOVERIES_PER_RUN = 2

export async function sendReconnectEmails(
  database: Database,
  userIds: string[],
  origin: string,
  now: Date,
  budget: Budget
): Promise<void> {
  let sentCount = 0
  for (const userId of userIds) {
    if (sentCount >= MAX_EMAILS_PER_RUN || !budget.take(1)) break
    const row = await database
      .select({
        email: user.email,
        name: user.name,
        lostSince: flamekeeper.lostSince,
      })
      .from(flamekeeper)
      .innerJoin(user, eq(user.id, flamekeeper.userId))
      .where(eq(flamekeeper.userId, userId))
      .get()
    if (!row?.lostSince) continue
    sentCount++
    const deadline = new Date(row.lostSince.getTime() + LOST_GRACE_MS)
    const deadlineText = formatLongDate(deadline)
    const link = origin ? `${origin}/profile` : 'your account page'
    const sent = await sendEmail({
      to: row.email,
      subject: 'Reconnect your Google Drive to keep your photos in the app',
      text: `Hi ${row.name},\n\nWe can no longer reach the Google Drive you connected as a flamekeeper (the connection was revoked or expired). Please reconnect it by ${deadlineText}: ${link}\n\nAfter that date the photos stored in your Drive drop out of the app and albums left empty are hidden. The files themselves stay in your Drive, and reconnecting later brings the photos back.\n\nThank you for keeping the flame.`,
    })
    if (sent) {
      await database
        .update(flamekeeper)
        .set({ lostNotifiedAt: now })
        .where(eq(flamekeeper.userId, userId))
    }
  }
}

export async function finalizeLost(
  database: Database,
  userId: string,
  now: Date,
  env: HealthEnv,
  budget: Budget
): Promise<void> {
  const volumes = await database
    .select({
      albumId: volume.albumId,
      title: album.title,
      driveFolderId: album.driveFolderId,
      ownerUserId: album.ownerUserId,
      deletedAt: album.deletedAt,
    })
    .from(volume)
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(and(eq(volume.flamekeeperUserId, userId), isNull(volume.droppedAt)))
    .limit(MAX_FINALIZE_VOLUMES_PER_RUN)
    .all()

  let stopped = false
  for (const v of volumes) {
    const others = await database
      .select({ n: sql<number>`COUNT(*)` })
      .from(photo)
      .where(
        and(
          eq(photo.albumId, v.albumId),
          eq(photo.state, 'live'),
          sql`(${photo.flamekeeperUserId} IS NULL OR ${photo.flamekeeperUserId} != ${userId})`
        )
      )
      .get()
    const tombstone = Number(others?.n ?? 0) === 0 && !v.deletedAt
    const notify =
      tombstone && !!env.TELEGRAM_BOT_TOKEN
        ? !!(await ownerTelegramChat(database, v.ownerUserId))
        : false
    if (notify && !budget.take(1)) {
      stopped = true
      break
    }

    const held = await database
      .select({ bytes: sql<number>`COALESCE(SUM(${photo.bytes}), 0)` })
      .from(photo)
      .where(
        and(
          eq(photo.albumId, v.albumId),
          eq(photo.flamekeeperUserId, userId),
          eq(photo.state, 'live')
        )
      )
      .get()
    await database
      .update(photo)
      .set({ state: 'dropped' })
      .where(
        and(
          eq(photo.albumId, v.albumId),
          eq(photo.flamekeeperUserId, userId),
          eq(photo.state, 'live')
        )
      )
    await adjustUsedBytes(database, userId, -Number(held?.bytes ?? 0))

    await database
      .update(album)
      .set({
        ...albumRecountSet(v.albumId),
        ...(tombstone
          ? {
              deletedAt: now,
              tombstoneReason: 'flamekeeper_lost' as const,
              coverFileId: null,
            }
          : {
              coverFileId: sql`CASE WHEN ${album.coverFileId} IN (SELECT ${photo.driveFileId} FROM ${photo} WHERE ${photo.albumId} = ${v.albumId} AND ${photo.flamekeeperUserId} = ${userId} AND ${photo.state} = 'dropped') THEN NULL ELSE ${album.coverFileId} END`,
            }),
        updatedAt: now,
      })
      .where(eq(album.id, v.albumId))

    if (tombstone) {
      await database
        .update(user)
        .set({ albumCount: sql`MAX(${user.albumCount} - 1, 0)` })
        .where(eq(user.id, v.ownerUserId))
    }
    await invalidateCachedListing(v.driveFolderId)
    await invalidateCachedDetailCore(v.albumId)
    await database
      .update(volume)
      .set({ droppedAt: now })
      .where(
        and(eq(volume.albumId, v.albumId), eq(volume.flamekeeperUserId, userId))
      )

    if (notify) {
      await notifyAlbumTombstoned(
        database,
        env,
        { id: v.albumId, title: v.title, ownerUserId: v.ownerUserId },
        'flamekeeper_lost'
      )
    }
  }

  if (!stopped && volumes.length < MAX_FINALIZE_VOLUMES_PER_RUN) {
    await database
      .update(flamekeeper)
      .set({ lostFinalizedAt: now })
      .where(eq(flamekeeper.userId, userId))
  }
}

async function markBatch(
  database: Database,
  albumId: string,
  userId: string,
  state: 'live' | 'deleted',
  limit: number
): Promise<{ id: string; bytes: number }[]> {
  const rows = await database
    .select({ id: photo.id, bytes: photo.bytes })
    .from(photo)
    .where(
      and(
        eq(photo.albumId, albumId),
        eq(photo.flamekeeperUserId, userId),
        eq(photo.state, 'dropped')
      )
    )
    .limit(limit)
    .all()
  if (rows.length === 0) return rows
  const statements = chunk(
    rows.map((r) => r.id),
    IN_CHUNK
  ).map((ids) =>
    database
      .update(photo)
      .set({ state })
      .where(and(inArray(photo.id, ids), eq(photo.state, 'dropped')))
  )
  await database.batch(statements as unknown as [(typeof statements)[0]])
  return rows
}

export async function recoverDropped(
  database: Database,
  now: Date,
  budget: Budget
): Promise<void> {
  const rows = await database
    .select({
      albumId: volume.albumId,
      userId: volume.flamekeeperUserId,
      permissionId: volume.permissionId,
      volumeFolderId: volume.driveFolderId,
      email: user.email,
      title: album.title,
      driveFolderId: album.driveFolderId,
      ownerUserId: album.ownerUserId,
      deletedAt: album.deletedAt,
      tombstoneReason: album.tombstoneReason,
      expiresAt: album.expiresAt,
      pinned: album.pinned,
    })
    .from(volume)
    .innerJoin(flamekeeper, eq(flamekeeper.userId, volume.flamekeeperUserId))
    .innerJoin(user, eq(user.id, volume.flamekeeperUserId))
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(
      and(
        isNotNull(volume.droppedAt),
        isNull(user.bannedAt),
        inArray(flamekeeper.state, ['active', 'full', 'draining'])
      )
    )
    .orderBy(asc(volume.albumId))
    .limit(RECOVERIES_PER_RUN)
    .all()

  for (const v of rows) {
    try {
      let action = planRecovery(v, now)

      if (action === 'restore') {
        if (
          planRecoveryShare({
            driveFolderId: v.volumeFolderId,
            permissionId: v.permissionId,
            hasPhotoRows: await volumeHasPhotoRows(
              database,
              v.albumId,
              v.userId
            ),
          })
        ) {
          if (!budget.take(2)) break
          try {
            const permissionId = await shareWithWriter(
              await getGoogleAccessToken(),
              v.volumeFolderId!,
              v.email
            )
            await database
              .update(volume)
              .set({ permissionId })
              .where(
                and(
                  eq(volume.albumId, v.albumId),
                  eq(volume.flamekeeperUserId, v.userId)
                )
              )
          } catch (error) {
            if (!(error instanceof DriveNotFoundError)) {
              console.warn(`Could not re-share album ${v.albumId}:`, error)
              continue
            }
            action = 'abandon'
          }
        }
      }

      const batch = await markBatch(
        database,
        v.albumId,
        v.userId,
        action === 'restore' ? 'live' : 'deleted',
        RESTORE_BATCH
      )

      if (action === 'restore' && batch.length > 0) {
        const current = await database
          .select({ deletedAt: album.deletedAt })
          .from(album)
          .where(eq(album.id, v.albumId))
          .get()
        const revive =
          !!current?.deletedAt && v.tombstoneReason === 'flamekeeper_lost'
        await adjustUsedBytes(
          database,
          v.userId,
          batch.reduce((sum, r) => sum + r.bytes, 0)
        )
        await database
          .update(album)
          .set({
            ...albumRecountSet(v.albumId),
            ...(revive ? { deletedAt: null, tombstoneReason: null } : {}),
            updatedAt: now,
          })
          .where(eq(album.id, v.albumId))
        if (revive) {
          await database
            .update(user)
            .set({ albumCount: sql`${user.albumCount} + 1` })
            .where(eq(user.id, v.ownerUserId))
        }
        await invalidateCachedListing(v.driveFolderId)
        await invalidateCachedDetailCore(v.albumId)
      }

      const more = await database
        .select({ id: photo.id })
        .from(photo)
        .where(
          and(
            eq(photo.albumId, v.albumId),
            eq(photo.flamekeeperUserId, v.userId),
            eq(photo.state, 'dropped')
          )
        )
        .limit(1)
        .get()
      if (more) continue

      if (action === 'restore') {
        await database
          .update(volume)
          .set({ droppedAt: null })
          .where(
            and(
              eq(volume.albumId, v.albumId),
              eq(volume.flamekeeperUserId, v.userId)
            )
          )
        await database
          .update(flamekeeper)
          .set({ healthCheckedAt: null, healthCursor: null })
          .where(eq(flamekeeper.userId, v.userId))
      } else {
        await database
          .delete(volume)
          .where(
            and(
              eq(volume.albumId, v.albumId),
              eq(volume.flamekeeperUserId, v.userId)
            )
          )
      }
    } catch (error) {
      console.error(
        `Recovery failed for album ${v.albumId} of ${v.userId}:`,
        error
      )
    }
  }
}
