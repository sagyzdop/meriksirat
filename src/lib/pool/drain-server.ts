import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  album,
  flamekeeper,
  photo,
  uploadReservation,
  user,
  volume,
} from '@/db/schema'
import {
  DriveNotFoundError,
  deleteDriveFile,
  getDriveFileMeta,
} from '@/lib/google/google-drive'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import {
  FlamekeeperGrantError,
  dropFlamekeeperGrant,
  getFlamekeeperAccessToken,
} from '@/lib/flamekeeper/tokens'
import {
  MIN_PLEDGE_BYTES,
  MIN_PLEDGE_GB,
  formatGb,
} from '@/lib/flamekeeper/rules'
import type { DrainStatus, RelayHandout } from '@/lib/flamekeeper/types'
import { dropPhotoRows, removeAlbum } from '@/lib/albums/expiry'
import { batchDeleteCost, takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { OUT_OF_SPACE_MESSAGE } from './placement'
import {
  deleteOwnedPhotos,
  releaseOwnedBytes,
  sendAdminsTelegram,
  startFlamekeeperUpload,
} from './server'
import { notifyAlbumTombstoned, type NoticeEnv } from './notices'
import {
  drainAdminAlertDue,
  drainBytesLeft,
  drainReminderDue,
  isDrainOverdue,
  pickDeadlineDeletions,
  planDrainProgress,
  planOptOut,
  type DrainFlamekeeper,
  type DrainTransition,
} from './drain'
import { planFlamekeeperEdit } from './graduation'
import { loadVolumeFolderId, releaseVolumes } from './volumes-server'
import { volumeParents } from './volumes'

type Database = ReturnType<typeof db>

const RELAY_CANDIDATES = 20
const DEADLINE_DELETES_PER_RUN = 200
const REMINDERS_PER_RUN = 2
const ADVANCES_PER_RUN = 2
const ADMIN_ALERTS_PER_RUN = 2
const DEADLINE_ALBUMS_PER_RUN = 3

export interface DrainRow extends DrainFlamekeeper {
  userId: string
  graduationDate: string
  drainAdminStartedAt: Date | null
  drainAdminRemindedAt: Date | null
}

export const drainColumns = {
  userId: flamekeeper.userId,
  state: flamekeeper.state,
  pledgedBytes: flamekeeper.pledgedBytes,
  usedBytes: flamekeeper.usedBytes,
  drainReason: flamekeeper.drainReason,
  drainingDeadline: flamekeeper.drainingDeadline,
  drainReminderSentAt: flamekeeper.drainReminderSentAt,
  drainAdminStartedAt: flamekeeper.drainAdminStartedAt,
  drainAdminRemindedAt: flamekeeper.drainAdminRemindedAt,
  graduationDate: flamekeeper.graduationDate,
}

export async function loadDrainRow(
  database: Database,
  userId: string
): Promise<DrainRow | null> {
  const row = await database
    .select(drainColumns)
    .from(flamekeeper)
    .where(eq(flamekeeper.userId, userId))
    .get()
  return row ?? null
}

function toStatus(row: DrainRow): DrainStatus {
  return {
    state: row.state,
    drainReason: row.drainReason,
    drainingDeadline: row.drainingDeadline,
    bytesLeft: drainBytesLeft(row),
  }
}

export async function getDrainStatus(
  database: Database,
  userId: string
): Promise<DrainStatus> {
  const row = await loadDrainRow(database, userId)
  if (!row) throw new Error('Not a flamekeeper')
  return toStatus(row)
}

async function loadVolumePhotos(
  database: Database,
  userId: string,
  limit: number
) {
  return database
    .select({
      id: photo.id,
      albumId: photo.albumId,
      driveFileId: photo.driveFileId,
      name: photo.name,
      mimeType: photo.mimeType,
      bytes: photo.bytes,
      flamekeeperUserId: photo.flamekeeperUserId,
    })
    .from(volume)
    .innerJoin(
      photo,
      and(
        eq(photo.albumId, volume.albumId),
        eq(photo.flamekeeperUserId, volume.flamekeeperUserId)
      )
    )
    .where(and(eq(volume.flamekeeperUserId, userId), eq(photo.state, 'live')))
    .limit(limit)
    .all()
}

export async function hasPhotosLeft(
  database: Database,
  userId: string
): Promise<boolean> {
  return (await loadVolumePhotos(database, userId, 1)).length > 0
}

async function releaseEmptyVolumes(
  database: Database,
  userId: string,
  albumIds?: string[],
  budget?: Budget
): Promise<boolean> {
  return releaseVolumes(
    database,
    and(
      eq(volume.flamekeeperUserId, userId),
      albumIds ? inArray(volume.albumId, albumIds) : undefined
    ),
    { budget }
  )
}

async function finalizeDrained(
  database: Database,
  userId: string,
  now: Date,
  budget?: Budget
): Promise<boolean> {
  if (!(await releaseEmptyVolumes(database, userId, undefined, budget))) {
    return false
  }
  const left = await database
    .select({ albumId: volume.albumId })
    .from(volume)
    .where(eq(volume.flamekeeperUserId, userId))
    .limit(1)
    .get()
  if (left) return false
  const inFlight = await database
    .select({ id: uploadReservation.id })
    .from(uploadReservation)
    .where(
      and(
        eq(uploadReservation.flamekeeperUserId, userId),
        sql`${uploadReservation.expiresAt} > ${now.getTime()}`
      )
    )
    .limit(1)
    .get()
  if (inFlight) return false

  if (!takeIfBudgeted(budget, 1)) return false
  await database
    .delete(uploadReservation)
    .where(eq(uploadReservation.flamekeeperUserId, userId))
  await dropFlamekeeperGrant(database, userId)
  await database
    .update(flamekeeper)
    .set({
      state: 'drained',
      usedBytes: 0,
      driveUsageBytes: 0,
      drainReason: null,
      drainingDeadline: null,
      drainReminderSentAt: null,
      drainAdminStartedAt: null,
      drainAdminRemindedAt: null,
      updatedAt: now,
    })
    .where(eq(flamekeeper.userId, userId))
  return true
}

export async function applyDrainTransition(
  database: Database,
  userId: string,
  transition: DrainTransition,
  now: Date,
  budget?: Budget
): Promise<void> {
  switch (transition.kind) {
    case 'drain':
      await database
        .update(flamekeeper)
        .set({
          state: 'draining',
          drainReason: transition.drainReason,
          drainingDeadline: transition.drainingDeadline,
          drainReminderSentAt: null,
          drainAdminStartedAt: null,
          drainAdminRemindedAt: null,
          updatedAt: now,
        })
        .where(eq(flamekeeper.userId, userId))
      return
    case 'resume':
      await database
        .update(flamekeeper)
        .set({
          state: 'active',
          drainReason: null,
          drainingDeadline: null,
          drainReminderSentAt: null,
          drainAdminStartedAt: null,
          drainAdminRemindedAt: null,
          updatedAt: now,
        })
        .where(eq(flamekeeper.userId, userId))
      return
    case 'drained':
      await finalizeDrained(database, userId, now, budget)
      return
    case 'refuse':
      throw new Error(transition.message)
  }
}

async function advanceDrain(
  database: Database,
  userId: string,
  now: Date,
  budget?: Budget
): Promise<DrainRow | null> {
  const row = await loadDrainRow(database, userId)
  if (!row || row.state !== 'draining') return row
  const transition = planDrainProgress(
    row,
    row.drainReason !== 'pledge' ? await hasPhotosLeft(database, userId) : true
  )
  if (transition.kind === 'none') return row
  await applyDrainTransition(database, userId, transition, now, budget)
  return loadDrainRow(database, userId)
}

async function sendFlamekeeperEmail(
  database: Database,
  userId: string,
  subject: string,
  body: (name: string) => string
): Promise<boolean> {
  const owner = await database
    .select({ email: user.email, name: user.name, firstName: user.firstName })
    .from(user)
    .where(eq(user.id, userId))
    .get()
  if (!owner) return false
  const { sendEmail } = await import('@/lib/google/email')
  return sendEmail({
    to: owner.email,
    subject,
    text: body(owner.firstName || owner.name),
  })
}

function formatDay(d: Date | null): string {
  return d
    ? d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Almaty',
      })
    : ''
}

function accountLink(): string {
  const origin = (process.env.BETTER_AUTH_URL ?? '').trim().replace(/\/+$/, '')
  return origin ? `\n\nOpen your account page: ${origin}/profile` : ''
}

const DRAIN_WHY: Record<NonNullable<DrainRow['drainReason']>, string> = {
  opt_out: 'You switched flamekeeping off',
  pledge: 'You lowered your pledge below what you already hold',
  graduation:
    'Your expected graduation date is less than 60 days away and your account is about to move to alumni storage',
  domain:
    'Your account is no longer an @nu.edu.kz account, so it cannot keep lending storage',
  ban: 'Your account was banned',
}

export async function sendDrainStartedEmail(
  database: Database,
  row: DrainRow
): Promise<void> {
  const left = formatGb(drainBytesLeft(row))
  const why = DRAIN_WHY[row.drainReason ?? 'pledge']
  await sendFlamekeeperEmail(
    database,
    row.userId,
    '#savenuimg: we are moving your photos',
    (name) =>
      `Hi ${name},\n\n${why}, so ${left} of club photos now need to move to other flamekeepers. Open your account page and keep the tab open while the photos move; an admin may also move them for you.\n\nPhotos still with you on ${formatDay(row.drainingDeadline)} will be deleted.${accountLink()}\n\nThank you for keeping the flame.`
  )
}

export async function optOutFlamekeeper(
  database: Database,
  userId: string,
  now: Date = new Date()
): Promise<DrainStatus> {
  const row = await loadDrainRow(database, userId)
  if (!row) throw new Error('You are not a flamekeeper')
  const transition = planOptOut(row, now, await hasPhotosLeft(database, userId))
  await applyDrainTransition(database, userId, transition, now)
  const updated = (await loadDrainRow(database, userId))!
  if (transition.kind === 'drain')
    await sendDrainStartedEmail(database, updated)
  return toStatus(updated)
}

export async function changePledge(
  database: Database,
  userId: string,
  input: { pledgedBytes: number; graduationDate: string },
  now: Date = new Date()
): Promise<void> {
  const row = await loadDrainRow(database, userId)
  if (!row) throw new Error('You are not a flamekeeper')
  if (
    input.pledgedBytes < MIN_PLEDGE_BYTES &&
    input.pledgedBytes < row.pledgedBytes
  ) {
    throw new Error(`Pledge at least ${MIN_PLEDGE_GB} GB`)
  }
  const hasPhotos = row.usedBytes > 0 && (await hasPhotosLeft(database, userId))
  const transition = planFlamekeeperEdit(row, input, now, hasPhotos)
  await database
    .update(flamekeeper)
    .set({
      pledgedBytes: input.pledgedBytes,
      graduationDate: input.graduationDate,
      graduationConfirmedAt: now,
      updatedAt: now,
    })
    .where(eq(flamekeeper.userId, userId))
  await applyDrainTransition(database, userId, transition, now)
  if (transition.kind === 'drain') {
    await sendDrainStartedEmail(
      database,
      (await loadDrainRow(database, userId))!
    )
  }
}

export async function startRelay(
  database: Database,
  sourceUserId: string,
  origin: string | undefined
): Promise<RelayHandout> {
  const now = new Date()
  const row = await advanceDrain(database, sourceUserId, now)
  if (!row) throw new Error('Not a flamekeeper')
  if (row.state !== 'draining') return { kind: 'done', status: toStatus(row) }

  const candidates = await loadVolumePhotos(
    database,
    sourceUserId,
    RELAY_CANDIDATES
  )
  if (candidates.length === 0) {
    return { kind: 'done', status: toStatus(row) }
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)]

  const albumRow = await database
    .select({ id: album.id, driveFolderId: album.driveFolderId })
    .from(album)
    .where(eq(album.id, pick.albumId))
    .get()
  if (!albumRow) throw new Error('Album not found')

  const sourceToken = await getFlamekeeperAccessToken(database, sourceUserId)
  let session: { uploadUrl: string; reservationId: string }
  try {
    session = await startFlamekeeperUpload(
      database,
      await getGoogleAccessToken(),
      albumRow,
      {
        name: pick.name,
        mimeType: pick.mimeType,
        bytes: pick.bytes,
        origin,
      },
      { exclude: [sourceUserId] }
    )
  } catch (error) {
    if (error instanceof Error && error.message === OUT_OF_SPACE_MESSAGE) {
      return {
        kind: 'no_space',
        message:
          'No other flamekeeper has room for these photos right now. Try again once more flamekeepers join.',
      }
    }
    throw error
  }

  return {
    kind: 'photo',
    photoId: pick.id,
    albumId: pick.albumId,
    sourceFileId: pick.driveFileId,
    name: pick.name,
    mimeType: pick.mimeType,
    bytes: pick.bytes,
    sourceToken,
    uploadUrl: session.uploadUrl,
    reservationId: session.reservationId,
  }
}

async function invalidateAlbumDetailIfCached(albumId: string): Promise<void> {
  const { getCachedDetailCore, invalidateCachedDetailCore } =
    await import('@/lib/albums/server')
  if (await getCachedDetailCore(albumId)) {
    await invalidateCachedDetailCore(albumId)
  }
}

export async function confirmRelay(
  database: Database,
  sourceUserId: string,
  input: { photoId: string; reservationId: string; fileId: string }
): Promise<DrainStatus> {
  const now = new Date()
  const reservation = await database
    .select()
    .from(uploadReservation)
    .where(eq(uploadReservation.id, input.reservationId))
    .get()
  if (!reservation) throw new Error('Move session expired, try again')
  const destUserId = reservation.flamekeeperUserId
  if (destUserId === sourceUserId) throw new Error('Invalid move session')

  const albumRow = await database
    .select({ id: album.id, driveFolderId: album.driveFolderId })
    .from(album)
    .where(eq(album.id, reservation.albumId))
    .get()
  if (!albumRow) throw new Error('Album not found')

  const destToken = await getFlamekeeperAccessToken(database, destUserId)
  const copy = await getDriveFileMeta(destToken, input.fileId)
  const destParents = volumeParents(
    albumRow.driveFolderId,
    await loadVolumeFolderId(database, albumRow.id, destUserId)
  )
  if (copy.trashed || !copy.parents?.some((id) => destParents.includes(id))) {
    throw new Error('Moved copy not found in the album folder')
  }

  const original = await database
    .select({
      id: photo.id,
      albumId: photo.albumId,
      driveFileId: photo.driveFileId,
      bytes: photo.bytes,
      flamekeeperUserId: photo.flamekeeperUserId,
      state: photo.state,
    })
    .from(photo)
    .where(eq(photo.id, input.photoId))
    .get()

  const copyBytes = Number(copy.size ?? 0) || 0
  const stale =
    !original ||
    original.albumId !== albumRow.id ||
    original.flamekeeperUserId !== sourceUserId ||
    original.state !== 'live'
  const incomplete =
    !!original && original.bytes > 0 && copyBytes !== original.bytes

  if (stale || incomplete) {
    try {
      await deleteDriveFile(destToken, input.fileId)
    } catch (error) {
      console.warn('Failed to delete unused relay copy:', error)
    }
    await database
      .delete(uploadReservation)
      .where(eq(uploadReservation.id, reservation.id))
    if (incomplete) throw new Error('The moved copy was incomplete, try again')
    return getDrainStatus(database, sourceUserId)
  }

  const bytes = original.bytes || copyBytes
  const claimed = await database
    .update(photo)
    .set({ driveFileId: input.fileId, flamekeeperUserId: destUserId })
    .where(
      and(
        eq(photo.id, original.id),
        eq(photo.driveFileId, original.driveFileId),
        eq(photo.flamekeeperUserId, sourceUserId)
      )
    )
  if ((claimed.meta?.changes ?? 0) === 0) {
    try {
      await deleteDriveFile(destToken, input.fileId)
    } catch (error) {
      console.warn('Failed to delete unused relay copy:', error)
    }
    await database
      .delete(uploadReservation)
      .where(eq(uploadReservation.id, reservation.id))
    return getDrainStatus(database, sourceUserId)
  }
  await database.batch([
    database
      .update(flamekeeper)
      .set({
        usedBytes: sql`${flamekeeper.usedBytes} + ${bytes}`,
        driveUsageBytes: sql`${flamekeeper.driveUsageBytes} + ${bytes}`,
      })
      .where(eq(flamekeeper.userId, destUserId)),
    database
      .delete(uploadReservation)
      .where(eq(uploadReservation.id, reservation.id)),
    database
      .update(album)
      .set({ coverFileId: input.fileId })
      .where(
        and(
          eq(album.id, albumRow.id),
          eq(album.coverFileId, original.driveFileId)
        )
      ),
  ])

  try {
    const sourceToken = await getFlamekeeperAccessToken(database, sourceUserId)
    await deleteDriveFile(sourceToken, original.driveFileId)
  } catch (error) {
    if (!(error instanceof DriveNotFoundError)) {
      console.warn(
        `Moved photo ${original.id}, but its old file stays in the source Drive:`,
        error
      )
    }
  }
  await releaseOwnedBytes(database, [
    {
      id: original.id,
      driveFileId: original.driveFileId,
      bytes,
      flamekeeperUserId: sourceUserId,
    },
  ])
  await releaseEmptyVolumes(database, sourceUserId, [albumRow.id])
  await invalidateAlbumDetailIfCached(albumRow.id)

  const row = await advanceDrain(database, sourceUserId, now)
  return toStatus(row!)
}

function albumsOf(photos: { albumId: string }[]): number {
  return new Set(photos.map((p) => p.albumId)).size
}

function deadlineCost(photos: { albumId: string }[]): number {
  if (photos.length === 0) return 0
  return batchDeleteCost(photos.length) + 1 + 3 * albumsOf(photos)
}

async function deleteOverdue(
  database: Database,
  row: DrainRow,
  now: Date,
  env: NoticeEnv,
  budget?: Budget
): Promise<void> {
  const candidates = await loadVolumePhotos(
    database,
    row.userId,
    DEADLINE_DELETES_PER_RUN
  )
  const albumsSeen = new Set<string>()
  let picked = pickDeadlineDeletions(row, candidates).filter((p) => {
    if (albumsSeen.has(p.albumId)) return true
    if (albumsSeen.size >= DEADLINE_ALBUMS_PER_RUN) return false
    albumsSeen.add(p.albumId)
    return true
  })
  while (picked.length > 0 && !takeIfBudgeted(budget, deadlineCost(picked))) {
    picked = picked.slice(0, Math.floor(picked.length / 2))
  }
  if (picked.length > 0) {
    const { deleted, error } = await deleteOwnedPhotos(database, picked)
    const byAlbum = new Map<string, string[]>()
    for (const p of picked) {
      if (!deleted.some((d) => d.id === p.id)) continue
      byAlbum.set(p.albumId, [...(byAlbum.get(p.albumId) ?? []), p.id])
    }
    for (const [albumId, ids] of byAlbum) {
      await dropPhotoRows(database, albumId, ids)
      await database
        .update(album)
        .set({ coverFileId: null })
        .where(
          and(
            eq(album.id, albumId),
            inArray(
              album.coverFileId,
              deleted
                .filter((d) => ids.includes(d.id))
                .map((d) => d.driveFileId)
            )
          )
        )
    }
    await tombstoneEmptyAlbums(database, [...byAlbum.keys()], env)
    if (byAlbum.size > 0) {
      await releaseEmptyVolumes(database, row.userId, [...byAlbum.keys()])
    }
    if (error) {
      if (error instanceof FlamekeeperGrantError) {
        console.warn(
          `Drain deadline for ${row.userId}: Drive grant failed, retrying later`
        )
      } else {
        console.error(`Drain deadline for ${row.userId}:`, error)
      }
    }
  }
  await advanceDrain(database, row.userId, now, budget)
}

async function tombstoneEmptyAlbums(
  database: Database,
  albumIds: string[],
  env: NoticeEnv
): Promise<void> {
  if (albumIds.length === 0) return
  const empty = await database
    .select({
      id: album.id,
      title: album.title,
      driveFolderId: album.driveFolderId,
      ownerUserId: album.ownerUserId,
      deletedAt: album.deletedAt,
      photoCount: album.photoCount,
      photosIndexedAt: album.photosIndexedAt,
    })
    .from(album)
    .where(inArray(album.id, albumIds))
    .all()
  const masterToken = await getGoogleAccessToken()
  for (const a of empty) {
    if (a.deletedAt || a.photoCount > 0 || !a.photosIndexedAt) {
      await invalidateAlbumDetailIfCached(a.id)
      continue
    }
    try {
      await removeAlbum(database, a, masterToken, {
        tombstone: 'flamekeeper_left',
      })
      await notifyAlbumTombstoned(database, env, a, 'flamekeeper_left')
    } catch (error) {
      console.error(`Failed to tombstone album ${a.id}:`, error)
    }
  }
}

function adminAlertText(
  kind: 'started' | 'reminder',
  who: string,
  row: DrainRow
): string {
  const left = formatGb(drainBytesLeft(row))
  const deadline = formatDay(row.drainingDeadline)
  if (kind === 'started') {
    return `#savenuimg drain started: ${who} (${row.drainReason ?? 'drain'}) has ${left} to move off. Deadline ${deadline}; photos still there then are deleted.`
  }
  return `#savenuimg drain deadline in 3 days: ${who} still holds ${left}. Photos left on ${deadline} are deleted. Move them or ask the flamekeeper to.`
}

async function alertAdminsOfDrains(
  database: Database,
  rows: DrainRow[],
  now: Date,
  botToken: string | undefined,
  budget?: Budget
): Promise<void> {
  let alerts = 0
  for (const row of rows) {
    if (alerts >= ADMIN_ALERTS_PER_RUN) break
    const due = drainAdminAlertDue(row, now)
    if (!due) continue
    alerts++
    const owner = await database
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, row.userId))
      .get()
    const who = owner ? `${owner.name} <${owner.email}>` : row.userId
    const handled = await sendAdminsTelegram(
      database,
      botToken,
      adminAlertText(due, who, row),
      budget
    )
    if (!handled) return
    await database
      .update(flamekeeper)
      .set(
        due === 'started'
          ? { drainAdminStartedAt: now }
          : { drainAdminRemindedAt: now }
      )
      .where(eq(flamekeeper.userId, row.userId))
  }
}

export async function runDrainMaintenance(
  env: {
    meriksirat_d1: D1Database
    TELEGRAM_BOT_TOKEN?: string
    BETTER_AUTH_URL?: string
  },
  budget?: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  const rows = await database
    .select(drainColumns)
    .from(flamekeeper)
    .where(eq(flamekeeper.state, 'draining'))
    .all()
  if (rows.length === 0) return

  await alertAdminsOfDrains(database, rows, now, env.TELEGRAM_BOT_TOKEN, budget)

  let reminders = 0
  for (const row of rows) {
    if (row.drainReason === 'ban') continue
    if (reminders >= REMINDERS_PER_RUN || !drainReminderDue(row, now)) continue
    if (!takeIfBudgeted(budget, 1)) break
    reminders++
    const left = formatGb(drainBytesLeft(row))
    const sent = await sendFlamekeeperEmail(
      database,
      row.userId,
      '#savenuimg: your photos will be deleted soon',
      (name) =>
        `Hi ${name},\n\n${left} of club photos are still with you. On ${formatDay(row.drainingDeadline)} the photos that have not moved will be deleted. Open your account page and keep the tab open to move them now.${accountLink()}`
    )
    if (sent) {
      await database
        .update(flamekeeper)
        .set({ drainReminderSentAt: now })
        .where(eq(flamekeeper.userId, row.userId))
    }
  }

  const overdue = rows.filter((row) => isDrainOverdue(row, now))
  const pick = overdue[Math.floor(Math.random() * overdue.length)]
  let advanced = 0
  for (const row of rows) {
    try {
      if (row === pick) {
        await deleteOverdue(database, row, now, env, budget)
      } else if (advanced < ADVANCES_PER_RUN) {
        const after = await advanceDrain(database, row.userId, now, budget)
        if (after?.state !== 'draining') advanced++
      }
    } catch (error) {
      console.error(`Drain maintenance failed for ${row.userId}:`, error)
    }
  }
}
