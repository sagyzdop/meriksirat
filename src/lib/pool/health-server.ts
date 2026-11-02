import { and, asc, eq, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  album,
  flamekeeper,
  flamekeeperGrant,
  photo,
  user,
  volume,
} from '@/db/schema'
import { BudgetExhaustedError, type Budget } from '@/lib/cron/budget'
import { formatLongDate } from '@/lib/club-time'
import { albumRecountSet } from '@/lib/albums/expiry'
import { siteOrigin } from '@/lib/format'
import {
  FlamekeeperGrantError,
  forgetFlamekeeperAccessToken,
  getFlamekeeperAccessToken,
} from '@/lib/flamekeeper/tokens'
import {
  DriveNotFoundError,
  getDriveAbout,
  listDriveFolderFiles,
  getDriveFolderState,
  shareWithWriter,
} from '@/lib/google/google-drive'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import { sendEmail } from '@/lib/google/email'
import {
  invalidateCachedDetailCore,
  invalidateCachedListing,
} from '@/lib/albums/server'
import {
  HEALTH_INTERVAL_MS,
  HEALTH_STEP_CAP,
  MAX_CONFIRMS_PER_ALBUM,
  pickConfirmCandidates,
  LOST_GRACE_MS,
  MISSING_GRACE_MS,
  RESTORE_BATCH,
  canBecomeLost,
  confirmMissing,
  findMissingPhotos,
  type FileProbeOutcome,
  type PhotoRef,
  isUniqueConstraintError,
  planEmailSync,
  planHealthBatch,
  planLost,
  planVolumeAudit,
  planRecovery,
  volumesAfterCursor,
} from './health'
import { notifyAlbumTombstoned, ownerTelegramChat } from './notices'
import { planRecoveryShare } from './volumes'
import { volumeHasPhotoRows } from './volumes-server'
import { sendAdminsTelegramResult } from './server'

type Database = ReturnType<typeof db>

interface HealthEnv {
  meriksirat_d1: D1Database
  TELEGRAM_BOT_TOKEN?: string
  BETTER_AUTH_URL?: string
}

const RETRY_AFTER_TRANSIENT_MS = 60 * 60 * 1000
const MAX_EMAILS_PER_RUN = 3
const MAX_FINALIZE_VOLUMES_PER_RUN = 10
const MAX_MISSING_LISTED = 10
const RECOVERIES_PER_RUN = 2
const IN_CHUNK = 90

let warnedNoAboutUser = false

interface MissingReport {
  email: string
  albumTitle: string
  count: number
}

function chunked<T>(items: T[], size: number = IN_CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
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

async function adjustUsedBytes(
  database: Database,
  userId: string,
  delta: number
): Promise<void> {
  if (delta === 0) return
  await database
    .update(flamekeeper)
    .set({ usedBytes: sql`MAX(${flamekeeper.usedBytes} + ${delta}, 0)` })
    .where(eq(flamekeeper.userId, userId))
}

async function removeMissingPhotos(
  database: Database,
  userId: string,
  albumRow: { id: string; driveFolderId: string },
  missing: { id: string }[]
): Promise<number> {
  const statements = chunked(missing.map((m) => m.id)).map((ids) =>
    database
      .update(photo)
      .set({ state: 'deleted' })
      .where(
        and(
          inArray(photo.id, ids),
          eq(photo.flamekeeperUserId, userId),
          eq(photo.state, 'live')
        )
      )
      .returning({
        id: photo.id,
        driveFileId: photo.driveFileId,
        bytes: photo.bytes,
      })
  )
  const results = await database.batch(
    statements as unknown as [(typeof statements)[0]]
  )
  const removed = results.flat()
  if (removed.length === 0) return 0

  await adjustUsedBytes(
    database,
    userId,
    -removed.reduce((sum, r) => sum + r.bytes, 0)
  )
  await database
    .update(album)
    .set({
      ...albumRecountSet(albumRow.id),
      updatedAt: new Date(),
    })
    .where(eq(album.id, albumRow.id))
  for (const ids of chunked(removed.map((r) => r.driveFileId))) {
    await database
      .update(album)
      .set({ coverFileId: null })
      .where(and(eq(album.id, albumRow.id), inArray(album.coverFileId, ids)))
  }
  await invalidateCachedListing(albumRow.driveFolderId)
  await invalidateCachedDetailCore(albumRow.id)
  return removed.length
}

async function auditVolumes(
  database: Database,
  userId: string,
  email: string,
  token: string,
  cursor: string | null,
  step: Budget,
  now: Date
): Promise<{
  reports: MissingReport[]
  nextCursor: string | null
  complete: boolean
}> {
  const volumes = await database
    .select({
      albumId: volume.albumId,
      title: album.title,
      driveFolderId: album.driveFolderId,
      volumeFolderId: volume.driveFolderId,
    })
    .from(volume)
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(
      and(
        eq(volume.flamekeeperUserId, userId),
        isNull(volume.droppedAt),
        isNull(album.deletedAt)
      )
    )
    .all()
  const byId = new Map(volumes.map((v) => [v.albumId, v]))
  const todo = volumesAfterCursor([...byId.keys()], cursor)

  const reports: MissingReport[] = []
  let lastDone = cursor
  for (const albumId of todo) {
    const v = byId.get(albumId)!
    try {
      const rows = await database
        .select({ id: photo.id, driveFileId: photo.driveFileId })
        .from(photo)
        .where(
          and(
            eq(photo.albumId, albumId),
            eq(photo.flamekeeperUserId, userId),
            eq(photo.state, 'live'),
            lte(photo.createdAt, new Date(now.getTime() - MISSING_GRACE_MS))
          )
        )
        .all()
      if (planVolumeAudit(v.volumeFolderId, rows) === 'skip') {
        if (rows.length > 0) {
          console.warn(
            `Health audit skipped album ${albumId} for ${userId}: volume has no folder id but ${rows.length} live photo rows`
          )
        }
        lastDone = albumId
        continue
      }
      const files = await listDriveFolderFiles(token, v.volumeFolderId!, () =>
        step.require(1)
      )
      const missing = findMissingPhotos(
        rows,
        files.map((f) => f.id)
      )
      const confirmed: PhotoRef[] = []
      let kept = 0
      const unchecked = Math.max(missing.length - MAX_CONFIRMS_PER_ALBUM, 0)
      let exhausted = false
      const candidates = pickConfirmCandidates(
        missing,
        MAX_CONFIRMS_PER_ALBUM,
        Math.random
      )
      for (const row of candidates) {
        let outcome: FileProbeOutcome
        try {
          step.require(1)
          const state = await getDriveFolderState(token, row.driveFileId)
          outcome = state === 'ok' ? 'exists' : state
        } catch (error) {
          if (error instanceof BudgetExhaustedError) {
            exhausted = true
            break
          }
          outcome = 'error'
        }
        if (confirmMissing(outcome) === 'remove') confirmed.push(row)
        else kept++
      }
      if (kept > 0 || unchecked > 0) {
        console.warn(
          `Health audit kept ${kept} photo rows of album ${albumId} for ${userId} that are absent from the folder listing but not confirmed gone${unchecked > 0 ? `; ${unchecked} not checked this run` : ''}`
        )
      }
      if (confirmed.length > 0) {
        const removed = await removeMissingPhotos(
          database,
          userId,
          { id: albumId, driveFolderId: v.driveFolderId },
          confirmed
        )
        if (removed > 0) {
          reports.push({ email, albumTitle: v.title, count: removed })
        }
      }
      if (exhausted) throw new BudgetExhaustedError()
    } catch (error) {
      if (error instanceof BudgetExhaustedError) {
        return { reports, nextCursor: lastDone, complete: false }
      }
      console.warn(`Health audit failed for album ${albumId}:`, error)
    }
    lastDone = albumId
  }
  return { reports, nextCursor: null, complete: true }
}

async function syncEmail(
  database: Database,
  userId: string,
  saved: string,
  reported: string | null
): Promise<string> {
  if (reported === null && !warnedNoAboutUser) {
    warnedNoAboutUser = true
    console.warn(
      'Drive about.get returned no user.emailAddress under drive.file; skipping the email sync'
    )
  }
  const plan = planEmailSync(saved, reported)
  if (plan.kind !== 'update') return saved
  try {
    await database
      .update(user)
      .set({ email: plan.email!, updatedAt: new Date() })
      .where(eq(user.id, userId))
    console.log(`Synced email of flamekeeper ${userId} from Google`)
    return plan.email!
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      console.error(
        `Google email for flamekeeper ${userId} is already used by another account; left unchanged`
      )
    } else {
      console.error(`Failed to sync email for ${userId}:`, error)
    }
    return saved
  }
}

async function checkGrants(
  database: Database,
  now: Date,
  budget: Budget
): Promise<MissingReport[]> {
  const step = budget.sub(HEALTH_STEP_CAP)
  const volumeCounts = database
    .select({
      userId: volume.flamekeeperUserId,
      n: sql<number>`COUNT(*)`.as('n'),
    })
    .from(volume)
    .where(isNull(volume.droppedAt))
    .groupBy(volume.flamekeeperUserId)
    .as('vc')

  const rows = await database
    .select({
      userId: flamekeeper.userId,
      email: user.email,
      state: flamekeeper.state,
      healthCheckedAt: flamekeeper.healthCheckedAt,
      healthCursor: flamekeeper.healthCursor,
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
  const picked = planHealthBatch(candidates, now, step.remaining())
  const reports: MissingReport[] = []

  for (const userId of picked) {
    const row = candidates.find((c) => c.userId === userId)!
    const resuming = !!row.healthCursor
    if (!step.take(resuming ? 1 : 2)) break
    forgetFlamekeeperAccessToken(userId)
    try {
      const token = await getFlamekeeperAccessToken(database, userId)
      let email = row.email
      await database
        .update(flamekeeperGrant)
        .set({ lastRefreshAt: now })
        .where(eq(flamekeeperGrant.userId, userId))
      if (!resuming) {
        const about = await getDriveAbout(token)
        await database
          .update(flamekeeper)
          .set(
            about.usageInDrive === null
              ? { driveUsageCheckedAt: now }
              : {
                  driveUsageBytes: about.usageInDrive,
                  driveUsageCheckedAt: now,
                }
          )
          .where(eq(flamekeeper.userId, userId))
        email = await syncEmail(database, userId, row.email, about.email)
      }
      const audit = await auditVolumes(
        database,
        userId,
        email,
        token,
        row.healthCursor,
        step,
        now
      )
      reports.push(...audit.reports)
      await database
        .update(flamekeeper)
        .set(
          audit.complete
            ? { healthCheckedAt: now, healthCursor: null }
            : {
                healthCheckedAt: new Date(now.getTime() - HEALTH_INTERVAL_MS),
                healthCursor: audit.nextCursor,
              }
        )
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
  reports: MissingReport[],
  budget: Budget
): Promise<void> {
  if (reports.length === 0) return
  const lines = reports
    .slice(0, MAX_MISSING_LISTED)
    .map((r) => `${r.email}: ${r.count} in "${r.albumTitle}"`)
  const extra =
    reports.length > MAX_MISSING_LISTED
      ? `\n...and ${reports.length - MAX_MISSING_LISTED} more albums`
      : ''
  await sendAdminsTelegramResult(
    database,
    botToken,
    `#savenuimg health check: photos missing from Drive were removed from their albums.\n${lines.join('\n')}${extra}`,
    budget,
    { force: true }
  )
}

async function sendReconnectEmails(
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

async function finalizeLost(
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
  const statements = chunked(rows.map((r) => r.id)).map((ids) =>
    database
      .update(photo)
      .set({ state })
      .where(and(inArray(photo.id, ids), eq(photo.state, 'dropped')))
  )
  await database.batch(statements as unknown as [(typeof statements)[0]])
  return rows
}

async function recoverDropped(
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

export async function runFlamekeeperHealth(
  env: HealthEnv,
  budget: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  const reports = await checkGrants(database, now, budget)
  await reportMissing(database, env.TELEGRAM_BOT_TOKEN, reports, budget)

  const lostRows = await database
    .select({
      userId: flamekeeper.userId,
      state: flamekeeper.state,
      lostSince: flamekeeper.lostSince,
      lostNotifiedAt: flamekeeper.lostNotifiedAt,
      lostFinalizedAt: flamekeeper.lostFinalizedAt,
      bannedAt: user.bannedAt,
    })
    .from(flamekeeper)
    .innerJoin(user, eq(user.id, flamekeeper.userId))
    .where(
      and(
        eq(flamekeeper.state, 'lost'),
        sql`(${flamekeeper.lostNotifiedAt} IS NULL OR ${flamekeeper.lostFinalizedAt} IS NULL)`
      )
    )
    .all()
  const plan = planLost(
    lostRows.map((r) => ({ ...r, banned: !!r.bannedAt })),
    now
  )

  const origin = siteOrigin(env.BETTER_AUTH_URL)
  await sendReconnectEmails(database, plan.notify, origin, now, budget)

  for (const userId of plan.finalize.slice(0, 1)) {
    try {
      await finalizeLost(database, userId, now, env, budget)
    } catch (error) {
      console.error(`Failed to finalize lost flamekeeper ${userId}:`, error)
    }
  }

  await recoverDropped(database, now, budget)
}
