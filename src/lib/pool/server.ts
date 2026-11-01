import { and, eq, inArray, isNotNull, lt, or, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  album,
  flamekeeper,
  photo,
  settings,
  uploadReservation,
  user,
  volume,
} from '@/db/schema'
import {
  DriveQuotaExceededError,
  batchDeleteDriveFiles,
  deleteDriveFile,
  getDriveFileMeta,
  getDriveUsageInDrive,
  mintResumableUpload,
  shareWithWriter,
} from '@/lib/google/google-drive'
import {
  FlamekeeperGrantError,
  forgetFlamekeeperAccessToken,
  getFlamekeeperAccessToken,
} from '@/lib/flamekeeper/tokens'
import { isImage } from '@/lib/albums/photo-backfill'
import { registerDrivePhotos } from '@/lib/albums/photo-index'
import { newId } from '@/lib/albums/ids'
import {
  DEFAULT_FLAMEKEEPER_CAP_BYTES,
  OUT_OF_SPACE_MESSAGE,
  placeUpload,
  poolAlert,
  poolStats,
  recoverFull,
  type PoolFlamekeeper,
  type PoolStats,
} from './placement'

type Database = ReturnType<typeof db>

const RESERVATION_TTL_MS = 2 * 60 * 60 * 1000
const RESERVATION_KEEP_MS = 24 * 60 * 60 * 1000
const MAX_PLACEMENT_TRIES = 4
const USAGE_REFRESH_MS = 60 * 60 * 1000
const USAGE_REFRESHES_PER_RUN = 10
export const MAX_PHOTO_DELETES_PER_CALL = 2000

export async function loadCapBytes(database: Database): Promise<number> {
  const row = await database
    .select({ cap: settings.flamekeeperCapBytes })
    .from(settings)
    .where(eq(settings.id, 'global'))
    .get()
  return row?.cap ?? DEFAULT_FLAMEKEEPER_CAP_BYTES
}

export async function loadPoolFlamekeepers(
  database: Database,
  now: Date = new Date()
): Promise<(PoolFlamekeeper & { email: string })[]> {
  const reserved = database
    .select({
      userId: uploadReservation.flamekeeperUserId,
      bytes: sql<number>`SUM(${uploadReservation.bytes})`.as('bytes'),
    })
    .from(uploadReservation)
    .where(sql`${uploadReservation.expiresAt} > ${now.getTime()}`)
    .groupBy(uploadReservation.flamekeeperUserId)
    .as('reserved')

  const rows = await database
    .select({
      userId: flamekeeper.userId,
      email: user.email,
      state: flamekeeper.state,
      pledgedBytes: flamekeeper.pledgedBytes,
      usedBytes: flamekeeper.usedBytes,
      driveUsageBytes: flamekeeper.driveUsageBytes,
      reservedBytes: reserved.bytes,
    })
    .from(flamekeeper)
    .innerJoin(user, eq(user.id, flamekeeper.userId))
    .leftJoin(reserved, eq(reserved.userId, flamekeeper.userId))
    .where(inArray(flamekeeper.state, ['active', 'full']))
    .all()

  return rows.map((r) => ({
    ...r,
    reservedBytes: Number(r.reservedBytes ?? 0),
  }))
}

export async function loadPoolStats(database: Database): Promise<PoolStats> {
  const [fks, cap] = await Promise.all([
    loadPoolFlamekeepers(database),
    loadCapBytes(database),
  ])
  return poolStats(fks, cap)
}

/**
 * Hold `bytes` of a flamekeeper's pledge for an upload in flight. A single
 * statement, so concurrent uploads can never push used + reserved past the
 * pledge.
 */
async function reserveUpload(
  database: Database,
  input: { id: string; userId: string; albumId: string; bytes: number },
  now: Date
): Promise<boolean> {
  const nowMs = now.getTime()
  const result = await database.run(sql`
    INSERT INTO upload_reservation (id, flamekeeper_user_id, album_id, bytes, expires_at)
    SELECT ${input.id}, f.user_id, ${input.albumId}, ${input.bytes}, ${nowMs + RESERVATION_TTL_MS}
    FROM flamekeeper f
    WHERE f.user_id = ${input.userId}
      AND f.state = 'active'
      AND f.used_bytes + ${input.bytes} + (
        SELECT COALESCE(SUM(r.bytes), 0) FROM upload_reservation r
        WHERE r.flamekeeper_user_id = f.user_id AND r.expires_at > ${nowMs}
      ) <= f.pledged_bytes
  `)
  return (result.meta?.changes ?? 0) > 0
}

async function dropReservation(database: Database, id: string): Promise<void> {
  await database.delete(uploadReservation).where(eq(uploadReservation.id, id))
}

export async function markFlamekeeperFull(
  database: Database,
  userId: string
): Promise<void> {
  await database
    .update(flamekeeper)
    .set({ state: 'full', updatedAt: new Date() })
    .where(and(eq(flamekeeper.userId, userId), eq(flamekeeper.state, 'active')))
}

/**
 * Share the album folder with the flamekeeper once, so their token can
 * upload into it. The share is recorded as the album's volume for them.
 */
async function ensureVolume(
  database: Database,
  masterToken: string,
  albumRow: { id: string; driveFolderId: string },
  fk: { userId: string; email: string }
): Promise<void> {
  const existing = await database
    .select({
      permissionId: volume.permissionId,
      writerRevokedAt: volume.writerRevokedAt,
    })
    .from(volume)
    .where(
      and(
        eq(volume.albumId, albumRow.id),
        eq(volume.flamekeeperUserId, fk.userId)
      )
    )
    .get()
  if (existing && !existing.writerRevokedAt) return
  const permissionId = await shareWithWriter(
    masterToken,
    albumRow.driveFolderId,
    fk.email
  )
  if (existing) {
    await database
      .update(volume)
      .set({ permissionId, writerRevokedAt: null })
      .where(
        and(
          eq(volume.albumId, albumRow.id),
          eq(volume.flamekeeperUserId, fk.userId)
        )
      )
    return
  }
  await database
    .insert(volume)
    .values({
      albumId: albumRow.id,
      flamekeeperUserId: fk.userId,
      permissionId,
    })
    .onConflictDoNothing()
}

/**
 * Place an upload on a flamekeeper and mint a resumable session with their
 * token, so the photo is owned by them. Flamekeepers whose Drive reports
 * the quota exceeded are marked full and the next one is tried.
 */
export async function startFlamekeeperUpload(
  database: Database,
  masterToken: string,
  albumRow: { id: string; driveFolderId: string },
  file: { name: string; mimeType: string; bytes: number; origin?: string },
  opts: { exclude?: string[] } = {}
): Promise<{ uploadUrl: string; reservationId: string }> {
  const exclude: string[] = [...(opts.exclude ?? [])]
  const cap = await loadCapBytes(database)

  for (let attempt = 0; attempt < MAX_PLACEMENT_TRIES; attempt++) {
    const now = new Date()
    const fks = await loadPoolFlamekeepers(database, now)
    const placement = placeUpload(fks, {
      bytes: file.bytes,
      capBytes: cap,
      exclude,
    })
    if (placement.kind === 'no_space') break
    const fk = fks.find((f) => f.userId === placement.userId)!
    exclude.push(fk.userId)

    const reservationId = newId(16)
    const reserved = await reserveUpload(
      database,
      {
        id: reservationId,
        userId: fk.userId,
        albumId: albumRow.id,
        bytes: file.bytes,
      },
      now
    )
    if (!reserved) continue

    try {
      const token = await getFlamekeeperAccessToken(database, fk.userId)
      await ensureVolume(database, masterToken, albumRow, fk)
      const uploadUrl = await mintResumableUpload(token, {
        name: file.name,
        folderId: albumRow.driveFolderId,
        mimeType: file.mimeType,
        size: file.bytes,
        origin: file.origin,
      })
      return { uploadUrl, reservationId }
    } catch (error) {
      await dropReservation(database, reservationId)
      if (error instanceof DriveQuotaExceededError) {
        await markFlamekeeperFull(database, fk.userId)
      } else if (error instanceof FlamekeeperGrantError) {
        console.warn(`Skipping flamekeeper ${fk.userId}:`, error.message)
      } else {
        throw error
      }
    }
  }
  throw new Error(OUT_OF_SPACE_MESSAGE)
}

/**
 * The browser reports an upload that failed after its session was minted.
 * The held space is released; a quota failure also marks the flamekeeper
 * full so the retry lands elsewhere.
 */
export async function releaseFlamekeeperUpload(
  database: Database,
  albumId: string,
  reservationId: string,
  quotaExceeded: boolean
): Promise<void> {
  const row = await database
    .select()
    .from(uploadReservation)
    .where(
      and(
        eq(uploadReservation.id, reservationId),
        eq(uploadReservation.albumId, albumId)
      )
    )
    .get()
  if (!row) return
  await dropReservation(database, row.id)
  if (quotaExceeded) await markFlamekeeperFull(database, row.flamekeeperUserId)
}

/**
 * Register a finished upload with its owner: the photo row records the
 * flamekeeper, and their used bytes take over from the reservation.
 */
export async function confirmFlamekeeperUpload(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  reservationId: string,
  fileId: string
): Promise<boolean> {
  const reservation = await database
    .select()
    .from(uploadReservation)
    .where(
      and(
        eq(uploadReservation.id, reservationId),
        eq(uploadReservation.albumId, albumRow.id)
      )
    )
    .get()
  if (!reservation) {
    const known = await database
      .select({ id: photo.id })
      .from(photo)
      .where(and(eq(photo.driveFileId, fileId), eq(photo.albumId, albumRow.id)))
      .get()
    if (known) return false
    throw new Error('Upload session expired, upload again')
  }

  const ownerId = reservation.flamekeeperUserId
  const token = await getFlamekeeperAccessToken(database, ownerId)
  const file = await getDriveFileMeta(token, fileId)
  if (file.trashed || !file.parents?.includes(albumRow.driveFolderId)) {
    throw new Error('Uploaded file not found in the album folder')
  }

  if (!isImage(file)) {
    await deleteDriveFile(token, fileId)
    await dropReservation(database, reservationId)
    return false
  }
  const inserted = await registerDrivePhotos(
    database,
    albumRow.id,
    [file],
    false,
    ownerId
  )
  const bytes = Number(file.size ?? 0) || 0

  await database.batch([
    database
      .update(flamekeeper)
      .set({
        usedBytes: sql`${flamekeeper.usedBytes} + ${bytes}`,
        driveUsageBytes: sql`${flamekeeper.driveUsageBytes} + ${bytes}`,
      })
      .where(eq(flamekeeper.userId, ownerId)),
    database
      .delete(uploadReservation)
      .where(eq(uploadReservation.id, reservationId)),
  ])
  return inserted > 0
}

export interface OwnedPhoto {
  id: string
  driveFileId: string
  bytes: number
  flamekeeperUserId: string | null
}

/**
 * Delete flamekeeper-owned photos with each owner's token, in Drive batches.
 * Returns the photos that were deleted (or already gone), those left behind
 * by a lost flamekeeper (whose files the app can no longer touch), and the
 * first other failure. Photos that failed for any other reason are in
 * neither list, so callers keep them in the app.
 */
export async function deleteOwnedPhotos(
  database: Database,
  photos: OwnedPhoto[]
): Promise<{ deleted: OwnedPhoto[]; lost: OwnedPhoto[]; error: unknown }> {
  const byOwner = new Map<string, OwnedPhoto[]>()
  for (const p of photos) {
    if (!p.flamekeeperUserId) continue
    const list = byOwner.get(p.flamekeeperUserId) ?? []
    list.push(p)
    byOwner.set(p.flamekeeperUserId, list)
  }

  const deleted: OwnedPhoto[] = []
  const lost: OwnedPhoto[] = []
  let failure: unknown = null

  for (const [ownerId, owned] of byOwner) {
    try {
      const token = await getFlamekeeperAccessToken(database, ownerId)
      const failedIds = new Set(
        await batchDeleteDriveFiles(
          token,
          owned.map((p) => p.driveFileId)
        )
      )
      for (const p of owned) {
        if (failedIds.has(p.driveFileId)) {
          failure ??= new Error('Some photos could not be deleted from Drive')
        } else {
          deleted.push(p)
        }
      }
    } catch (error) {
      const owner = await database
        .select({ state: flamekeeper.state })
        .from(flamekeeper)
        .where(eq(flamekeeper.userId, ownerId))
        .get()
      if (
        error instanceof FlamekeeperGrantError &&
        (!owner || owner.state === 'lost' || owner.state === 'drained')
      ) {
        lost.push(...owned)
      } else {
        forgetFlamekeeperAccessToken(ownerId)
        failure ??= error
      }
    }
  }

  await releaseOwnedBytes(database, deleted)
  return { deleted, lost, error: failure }
}

export async function releaseOwnedBytes(
  database: Database,
  photos: OwnedPhoto[]
): Promise<void> {
  const totals = new Map<string, number>()
  for (const p of photos) {
    if (!p.flamekeeperUserId) continue
    totals.set(
      p.flamekeeperUserId,
      (totals.get(p.flamekeeperUserId) ?? 0) + p.bytes
    )
  }
  if (totals.size === 0) return
  const statements = [...totals].map(([userId, bytes]) =>
    database
      .update(flamekeeper)
      .set({
        usedBytes: sql`MAX(${flamekeeper.usedBytes} - ${bytes}, 0)`,
        driveUsageBytes: sql`MAX(${flamekeeper.driveUsageBytes} - ${bytes}, 0)`,
      })
      .where(eq(flamekeeper.userId, userId))
  )
  await database.batch(statements as unknown as [(typeof statements)[0]])
}

export async function loadOwnedPhotos(
  database: Database,
  albumId: string
): Promise<OwnedPhoto[]> {
  return database
    .select({
      id: photo.id,
      driveFileId: photo.driveFileId,
      bytes: photo.bytes,
      flamekeeperUserId: photo.flamekeeperUserId,
    })
    .from(photo)
    .where(and(eq(photo.albumId, albumId), isNotNull(photo.flamekeeperUserId)))
    .limit(MAX_PHOTO_DELETES_PER_CALL + 1)
    .all()
}

export async function sendAdminsTelegram(
  database: Database,
  botToken: string | undefined,
  text: string
): Promise<void> {
  if (!botToken) {
    console.warn('TELEGRAM_BOT_TOKEN not configured, skipping pool alert')
    return
  }
  const { TelegramAPI } = await import('@/lib/telegram/api')
  const telegram = new TelegramAPI(botToken)
  const admins = await database
    .select({ chatId: user.telegramChatId })
    .from(user)
    .where(and(eq(user.role, 'admin'), isNotNull(user.telegramChatId)))
    .all()
  for (const admin of admins) {
    try {
      await telegram.sendMessage(admin.chatId!, text)
    } catch (error) {
      console.error('Failed to send pool alert:', error)
    }
  }
}

/**
 * Cron step: drop stale reservations, refresh Drive usage, return full
 * flamekeepers to active once space frees, and alert admins when the pool
 * runs low.
 */
export async function runPoolMaintenance(env: {
  meriksirat_d1: D1Database
  TELEGRAM_BOT_TOKEN?: string
}): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  await database
    .delete(uploadReservation)
    .where(
      lt(
        uploadReservation.expiresAt,
        new Date(now.getTime() - RESERVATION_KEEP_MS)
      )
    )

  const stale = await database
    .select({ userId: flamekeeper.userId })
    .from(flamekeeper)
    .where(
      and(
        inArray(flamekeeper.state, ['active', 'full']),
        or(
          isNull(flamekeeper.driveUsageCheckedAt),
          lt(
            flamekeeper.driveUsageCheckedAt,
            new Date(now.getTime() - USAGE_REFRESH_MS)
          )
        )
      )
    )
    .limit(USAGE_REFRESHES_PER_RUN)
    .all()

  for (const { userId } of stale) {
    try {
      const token = await getFlamekeeperAccessToken(database, userId)
      const usage = await getDriveUsageInDrive(token)
      await database
        .update(flamekeeper)
        .set({ driveUsageBytes: usage, driveUsageCheckedAt: now })
        .where(eq(flamekeeper.userId, userId))
    } catch (error) {
      console.warn(`Failed to refresh Drive usage for ${userId}:`, error)
    }
  }

  const [fks, cap, settingsRow] = await Promise.all([
    loadPoolFlamekeepers(database, now),
    loadCapBytes(database),
    database
      .select({ alertedAt: settings.poolLowAlertedAt })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get(),
  ])

  const recovered = recoverFull(fks, cap)
  if (recovered.length > 0) {
    await database
      .update(flamekeeper)
      .set({ state: 'active', updatedAt: now })
      .where(
        and(
          inArray(flamekeeper.userId, recovered),
          eq(flamekeeper.state, 'full')
        )
      )
    for (const fk of fks) if (recovered.includes(fk.userId)) fk.state = 'active'
  }

  if (!settingsRow) return
  const stats = poolStats(fks, cap)
  const alert = poolAlert(stats, settingsRow.alertedAt)
  if (alert === 'alert') {
    const { formatGb } = await import('@/lib/flamekeeper/rules')
    await sendAdminsTelegram(
      database,
      env.TELEGRAM_BOT_TOKEN,
      `#savenuimg pool is low: ${formatGb(stats.freeBytes)} free of ${formatGb(stats.pledgedBytes)} pledged across ${stats.flamekeepers} flamekeepers. Recruit flamekeepers or free up space.`
    )
    await database
      .update(settings)
      .set({ poolLowAlertedAt: now })
      .where(eq(settings.id, 'global'))
  } else if (alert === 'rearm') {
    await database
      .update(settings)
      .set({ poolLowAlertedAt: null })
      .where(eq(settings.id, 'global'))
  }
}

export async function countHostedAlbums(
  database: Database,
  userId: string
): Promise<number> {
  const row = await database
    .select({ count: sql<number>`count(*)` })
    .from(volume)
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(and(eq(volume.flamekeeperUserId, userId), isNull(album.deletedAt)))
    .get()
  return Number(row?.count ?? 0)
}
