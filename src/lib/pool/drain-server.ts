import { and, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import {
  flamekeeper,
  photo,
  uploadReservation,
  user,
  volume,
} from '@/db/schema'
import { dropFlamekeeperGrant } from '@/lib/flamekeeper/tokens'
import {
  MIN_PLEDGE_BYTES,
  MIN_PLEDGE_GB,
  formatGb,
} from '@/lib/flamekeeper/rules'
import type { DrainStatus } from '@/lib/flamekeeper/types'
import { formatLongDate } from '@/lib/club-time'
import { siteOrigin } from '@/lib/format'
import { createBudget, takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import {
  drainBytesLeft,
  planDrainProgress,
  planOptOut,
  type DrainFlamekeeper,
  type DrainTransition,
} from './drain'
import { planFlamekeeperEdit } from './graduation'
import { releaseVolumes } from './volumes-server'
import { releaseAbandonedCutoff } from './volumes'

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

export function toStatus(row: DrainRow): DrainStatus {
  return {
    state: row.state,
    drainReason: row.drainReason,
    drainingDeadline: row.drainingDeadline,
    bytesLeft: drainBytesLeft(row),
  }
}

export async function loadVolumePhotos(
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
  userId: string,
  { includeDropped = false }: { includeDropped?: boolean } = {}
): Promise<boolean> {
  if (includeDropped) {
    const pending = await database
      .select({ albumId: volume.albumId })
      .from(volume)
      .where(
        and(eq(volume.flamekeeperUserId, userId), isNotNull(volume.droppedAt))
      )
      .limit(1)
      .get()
    if (pending) return true
  }
  return (await loadVolumePhotos(database, userId, 1)).length > 0
}

export async function releaseEmptyVolumes(
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
    .where(
      and(
        eq(volume.flamekeeperUserId, userId),
        or(
          isNull(volume.releaseFirstBlockedAt),
          gt(volume.releaseFirstBlockedAt, releaseAbandonedCutoff(now))
        )
      )
    )
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

export async function advanceDrain(
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

const REQUEST_SUBREQUEST_BUDGET = 20

export async function finishedDrainStatus(
  database: Database,
  userId: string
): Promise<DrainStatus> {
  const row = await finishDrainIfEmpty(database, userId)
  if (!row) throw new Error('Not a flamekeeper')
  return toStatus(row)
}

export async function finishDrainIfEmpty(
  database: Database,
  userId: string
): Promise<DrainRow | null> {
  return advanceDrain(
    database,
    userId,
    new Date(),
    createBudget(REQUEST_SUBREQUEST_BUDGET)
  )
}

export async function sendFlamekeeperEmail(
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

export function accountLink(): string {
  const origin = siteOrigin(process.env.BETTER_AUTH_URL)
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
      `Hi ${name},\n\n${why}, so ${left} of club photos now need to move to other flamekeepers. Open your account page and keep the tab open while the photos move; an admin may also move them for you.\n\nPhotos still with you on ${formatLongDate(row.drainingDeadline)} will be deleted.${accountLink()}\n\nThank you for keeping the flame.`
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

export async function invalidateAlbumDetailIfCached(
  albumId: string
): Promise<void> {
  const { getCachedDetailCore, invalidateCachedDetailCore } =
    await import('@/lib/albums/server')
  if (await getCachedDetailCore(albumId)) {
    await invalidateCachedDetailCore(albumId)
  }
}
