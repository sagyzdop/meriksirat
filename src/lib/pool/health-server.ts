import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  album,
  favorite,
  flamekeeper,
  flamekeeperGrant,
  photo,
  user,
  volume,
} from '@/db/schema'
import {
  FlamekeeperGrantError,
  forgetFlamekeeperAccessToken,
  getFlamekeeperAccessToken,
} from '@/lib/flamekeeper/tokens'
import { listDriveFolderFiles } from '@/lib/google/google-drive'
import { sendEmail } from '@/lib/google/email'
import {
  invalidateCachedDetailCore,
  invalidateCachedListing,
} from '@/lib/albums/server'
import {
  HEALTH_INTERVAL_MS,
  LOST_GRACE_MS,
  canBecomeLost,
  findMissingPhotos,
  planHealthBatch,
  planLost,
} from './health'
import { sendAdminsTelegram } from './server'

type Database = ReturnType<typeof db>

const RETRY_AFTER_TRANSIENT_MS = 60 * 60 * 1000
const MAX_EMAILS_PER_RUN = 3
const MAX_FINALIZE_VOLUMES_PER_RUN = 10
const MAX_MISSING_LISTED = 10

interface MissingReport {
  email: string
  albumTitle: string
  count: number
}

async function markLost(
  database: Database,
  userId: string,
  now: Date
): Promise<void> {
  await database
    .update(flamekeeper)
    .set({ state: 'lost', lostSince: now, updatedAt: now })
    .where(
      and(
        eq(flamekeeper.userId, userId),
        inArray(flamekeeper.state, ['active', 'full', 'draining'])
      )
    )
}

async function auditVolumes(
  database: Database,
  userId: string,
  email: string,
  token: string
): Promise<MissingReport[]> {
  const volumes = await database
    .select({
      albumId: volume.albumId,
      title: album.title,
      driveFolderId: album.driveFolderId,
    })
    .from(volume)
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(and(eq(volume.flamekeeperUserId, userId), isNull(album.deletedAt)))
    .all()

  const reports: MissingReport[] = []
  for (const v of volumes) {
    try {
      const files = await listDriveFolderFiles(token, v.driveFolderId)
      const rows = await database
        .select({ id: photo.id, driveFileId: photo.driveFileId })
        .from(photo)
        .where(
          and(
            eq(photo.albumId, v.albumId),
            eq(photo.flamekeeperUserId, userId),
            eq(photo.state, 'live')
          )
        )
        .all()
      const missing = findMissingPhotos(
        rows,
        files.map((f) => f.id)
      )
      if (missing.length > 0) {
        reports.push({ email, albumTitle: v.title, count: missing.length })
      }
    } catch (error) {
      console.warn(`Health audit failed for album ${v.albumId}:`, error)
    }
  }
  return reports
}

async function checkGrants(
  database: Database,
  now: Date
): Promise<MissingReport[]> {
  const volumeCounts = database
    .select({
      userId: volume.flamekeeperUserId,
      n: sql<number>`COUNT(*)`.as('n'),
    })
    .from(volume)
    .groupBy(volume.flamekeeperUserId)
    .as('vc')

  const rows = await database
    .select({
      userId: flamekeeper.userId,
      email: user.email,
      state: flamekeeper.state,
      healthCheckedAt: flamekeeper.healthCheckedAt,
      volumeCount: volumeCounts.n,
    })
    .from(flamekeeper)
    .innerJoin(user, eq(user.id, flamekeeper.userId))
    .leftJoin(volumeCounts, eq(volumeCounts.userId, flamekeeper.userId))
    .where(inArray(flamekeeper.state, ['active', 'full', 'draining']))
    .all()

  const candidates = rows.map((r) => ({
    ...r,
    volumeCount: Number(r.volumeCount ?? 0),
  }))
  const picked = planHealthBatch(candidates, now)
  const reports: MissingReport[] = []

  for (const userId of picked) {
    const row = candidates.find((c) => c.userId === userId)!
    forgetFlamekeeperAccessToken(userId)
    try {
      const token = await getFlamekeeperAccessToken(database, userId)
      await database
        .update(flamekeeperGrant)
        .set({ lastRefreshAt: now })
        .where(eq(flamekeeperGrant.userId, userId))
      reports.push(...(await auditVolumes(database, userId, row.email, token)))
      await database
        .update(flamekeeper)
        .set({ healthCheckedAt: now })
        .where(eq(flamekeeper.userId, userId))
    } catch (error) {
      if (error instanceof FlamekeeperGrantError && error.revoked) {
        if (canBecomeLost(row.state)) await markLost(database, userId, now)
      } else {
        console.warn(`Health check failed for ${userId}:`, error)
        await database
          .update(flamekeeper)
          .set({
            healthCheckedAt: new Date(
              now.getTime() - HEALTH_INTERVAL_MS + RETRY_AFTER_TRANSIENT_MS
            ),
          })
          .where(eq(flamekeeper.userId, userId))
      }
    }
  }
  return reports
}

async function reportMissing(
  database: Database,
  botToken: string | undefined,
  reports: MissingReport[]
): Promise<void> {
  if (reports.length === 0) return
  const lines = reports
    .slice(0, MAX_MISSING_LISTED)
    .map((r) => `${r.email}: ${r.count} in "${r.albumTitle}"`)
  const extra =
    reports.length > MAX_MISSING_LISTED
      ? `\n...and ${reports.length - MAX_MISSING_LISTED} more albums`
      : ''
  await sendAdminsTelegram(
    database,
    botToken,
    `#savenuimg health check: photos missing from Drive.\n${lines.join('\n')}${extra}`
  )
}

async function sendReconnectEmails(
  database: Database,
  userIds: string[],
  origin: string,
  now: Date
): Promise<void> {
  for (const userId of userIds.slice(0, MAX_EMAILS_PER_RUN)) {
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
    const deadline = new Date(row.lostSince.getTime() + LOST_GRACE_MS)
    const deadlineText = deadline.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Almaty',
    })
    const link = origin ? `${origin}/profile` : 'your account page'
    const sent = await sendEmail({
      to: row.email,
      subject: 'Reconnect your Google Drive to keep your photos in the app',
      text: `Hi ${row.name},\n\nWe can no longer reach the Google Drive you connected as a flamekeeper (the connection was revoked or expired). Please reconnect it by ${deadlineText}: ${link}\n\nAfter that date the photos stored in your Drive drop out of the app and albums left empty are removed. The files themselves stay in your Drive.\n\nThank you for keeping the flame.`,
    })
    if (sent) {
      await database
        .update(flamekeeper)
        .set({ lostNotifiedAt: now })
        .where(eq(flamekeeper.userId, userId))
    }
  }
}

async function finalizeLost(
  database: Database,
  userId: string,
  now: Date
): Promise<void> {
  const volumes = await database
    .select({
      albumId: volume.albumId,
      driveFolderId: album.driveFolderId,
      ownerUserId: album.ownerUserId,
      deletedAt: album.deletedAt,
    })
    .from(volume)
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(eq(volume.flamekeeperUserId, userId))
    .limit(MAX_FINALIZE_VOLUMES_PER_RUN)
    .all()

  for (const v of volumes) {
    await database
      .update(photo)
      .set({ state: 'deleted' })
      .where(
        and(
          eq(photo.albumId, v.albumId),
          eq(photo.flamekeeperUserId, userId),
          eq(photo.state, 'live')
        )
      )
    const remaining = await database
      .select({ n: sql<number>`COUNT(*)` })
      .from(photo)
      .where(
        and(eq(photo.albumId, v.albumId), sql`${photo.state} != 'deleted'`)
      )
      .get()
    const empty = Number(remaining?.n ?? 0) === 0

    await database
      .update(album)
      .set({
        photoCount: sql`(SELECT COUNT(*) FROM ${photo} WHERE ${photo.albumId} = ${v.albumId} AND ${photo.state} = 'live')`,
        photoBytes: sql`(SELECT COALESCE(SUM(${photo.bytes}), 0) FROM ${photo} WHERE ${photo.albumId} = ${v.albumId} AND ${photo.state} = 'live')`,
        favoriteCount: sql`(SELECT COUNT(*) FROM ${favorite} INNER JOIN ${photo} ON ${photo.id} = ${favorite.photoId} WHERE ${photo.albumId} = ${v.albumId} AND ${photo.state} = 'live')`,
        ...(empty && !v.deletedAt
          ? {
              deletedAt: now,
              tombstoneReason: 'flamekeeper_lost' as const,
              coverFileId: null,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(album.id, v.albumId))

    if (empty && !v.deletedAt) {
      await database
        .update(user)
        .set({ albumCount: sql`MAX(${user.albumCount} - 1, 0)` })
        .where(eq(user.id, v.ownerUserId))
    }
    await invalidateCachedListing(v.driveFolderId)
    await invalidateCachedDetailCore(v.albumId)
    await database
      .delete(volume)
      .where(
        and(eq(volume.albumId, v.albumId), eq(volume.flamekeeperUserId, userId))
      )
  }

  if (volumes.length < MAX_FINALIZE_VOLUMES_PER_RUN) {
    await database
      .update(flamekeeper)
      .set({ lostFinalizedAt: now })
      .where(eq(flamekeeper.userId, userId))
  }
}

/**
 * Cron step: refresh each flamekeeper's Drive grant daily (keeping it inside
 * Google's idle limit), audit their files against the photo table, mark
 * revoked grants lost, email them once, and drop their photos from the app
 * when the 7-day reconnect window ends (ADR-0013).
 */
export async function runFlamekeeperHealth(env: {
  meriksirat_d1: D1Database
  TELEGRAM_BOT_TOKEN?: string
  BETTER_AUTH_URL?: string
}): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  const reports = await checkGrants(database, now)
  await reportMissing(database, env.TELEGRAM_BOT_TOKEN, reports)

  const lostRows = await database
    .select({
      userId: flamekeeper.userId,
      state: flamekeeper.state,
      lostSince: flamekeeper.lostSince,
      lostNotifiedAt: flamekeeper.lostNotifiedAt,
      lostFinalizedAt: flamekeeper.lostFinalizedAt,
    })
    .from(flamekeeper)
    .where(
      and(
        eq(flamekeeper.state, 'lost'),
        sql`(${flamekeeper.lostNotifiedAt} IS NULL OR ${flamekeeper.lostFinalizedAt} IS NULL)`
      )
    )
    .all()
  const plan = planLost(lostRows, now)

  const origin = (env.BETTER_AUTH_URL ?? '').trim().replace(/\/+$/, '')
  await sendReconnectEmails(database, plan.notify, origin, now)

  for (const userId of plan.finalize.slice(0, 1)) {
    try {
      await finalizeLost(database, userId, now)
    } catch (error) {
      console.error(`Failed to finalize lost flamekeeper ${userId}:`, error)
    }
  }
}
