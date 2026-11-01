import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm'
import { db } from '@/db'
import { album, booking, bookingItem, session, user, volume } from '@/db/schema'
import { isMasterEmail } from '@/lib/flamekeeper/master'
import { cancelBookingItems } from '@/lib/booking/booking-items'
import { deleteDrivePermission } from '@/lib/google/google-drive'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import {
  logBookingActivityById,
  logUserBanActivity,
} from '@/lib/telegram/logging'
import { formatUserDisplayName } from '@/lib/utils'
import {
  takeIfBudgeted,
  takeUpToIfBudgeted,
  type Budget,
} from '@/lib/cron/budget'
import { checkBan, pickPendingRevokes, planBanDrain } from './ban'
import {
  applyDrainTransition,
  hasPhotosLeft,
  loadDrainRow,
} from './drain-server'

type Database = ReturnType<typeof db>

const CANCELS_PER_RUN = 3
const REVOKES_PER_RUN = 10

function displayName(row: {
  firstName: string | null
  lastName: string | null
  name: string
  telegramUsername: string | null
}): string {
  return formatUserDisplayName({
    firstName: row.firstName ?? undefined,
    lastName: row.lastName ?? undefined,
    name: row.name,
    telegramUsername: row.telegramUsername ?? undefined,
  })
}

async function loadNames(database: Database, ids: string[]) {
  const rows = await database
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      telegramUsername: user.telegramUsername,
    })
    .from(user)
    .where(inArray(user.id, ids))
    .all()
  return new Map(rows.map((r) => [r.id, displayName(r)]))
}

async function cancelBannedBookings(
  database: Database,
  budget?: Budget
): Promise<void> {
  const upcoming = await database
    .select({ id: booking.id })
    .from(booking)
    .innerJoin(user, eq(user.id, booking.userId))
    .where(and(eq(booking.status, 'booked'), isNotNull(user.bannedAt)))
    .limit(CANCELS_PER_RUN)
    .all()

  for (const { id } of upcoming) {
    try {
      const items = await database
        .select({ id: bookingItem.id })
        .from(bookingItem)
        .where(eq(bookingItem.bookingId, id))
        .all()
      if (!takeIfBudgeted(budget, items.length + 2)) return
      if (items.length > 0) {
        await cancelBookingItems(
          database,
          items.map((it) => it.id)
        )
      }
      await logBookingActivityById(id, 'cancelled', {
        actorName: 'system',
        reason: 'Account banned',
      })
    } catch (error) {
      console.error(`Failed to cancel booking ${id} for a ban:`, error)
    }
  }
}

async function revokeBannedWriterAccess(
  database: Database,
  budget?: Budget
): Promise<void> {
  const rows = await database
    .select({
      albumId: volume.albumId,
      flamekeeperUserId: volume.flamekeeperUserId,
      permissionId: volume.permissionId,
      writerRevokedAt: volume.writerRevokedAt,
      driveFolderId: album.driveFolderId,
    })
    .from(volume)
    .innerJoin(user, eq(user.id, volume.flamekeeperUserId))
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(
      and(
        isNotNull(user.bannedAt),
        isNull(volume.writerRevokedAt),
        ne(volume.permissionId, '')
      )
    )
    .limit(REVOKES_PER_RUN)
    .all()

  let pending = pickPendingRevokes(rows, REVOKES_PER_RUN)
  if (pending.length === 0) return
  if (budget) {
    pending = takeIfBudgeted(budget, 1)
      ? pending.slice(0, takeUpToIfBudgeted(budget, pending.length))
      : []
    if (pending.length === 0) return
  }
  const masterToken = await getGoogleAccessToken()
  const now = new Date()
  for (const row of pending) {
    try {
      await deleteDrivePermission(
        masterToken,
        row.driveFolderId,
        row.permissionId
      )
      await database
        .update(volume)
        .set({ writerRevokedAt: now })
        .where(
          and(
            eq(volume.albumId, row.albumId),
            eq(volume.flamekeeperUserId, row.flamekeeperUserId)
          )
        )
    } catch (error) {
      console.warn(
        `Failed to revoke writer access on album ${row.albumId}:`,
        error
      )
    }
  }
}

async function finishBanWork(
  database: Database,
  budget?: Budget
): Promise<void> {
  await cancelBannedBookings(database, budget)
  await revokeBannedWriterAccess(database, budget)
}

export async function runBanMaintenance(
  env: { meriksirat_d1: D1Database },
  budget?: Budget
): Promise<void> {
  await finishBanWork(db(env.meriksirat_d1), budget)
}

export async function banUser(
  database: Database,
  input: { actorId: string; targetId: string; reason: string }
): Promise<void> {
  const check = checkBan(input)
  if (!check.ok) throw new Error(check.message)

  const target = await database
    .select({ id: user.id, email: user.email, bannedAt: user.bannedAt })
    .from(user)
    .where(eq(user.id, input.targetId))
    .get()
  if (!target) throw new Error('User not found')
  if (isMasterEmail(target.email, process.env.GOOGLE_MASTER_EMAIL)) {
    throw new Error(
      'The club account owns every album folder and cannot be banned.'
    )
  }
  if (target.bannedAt) throw new Error('User is already banned')

  const now = new Date()
  await database
    .update(user)
    .set({
      bannedAt: now,
      banReason: check.reason,
      bannedBy: input.actorId,
      updatedAt: now,
    })
    .where(eq(user.id, input.targetId))
  await database.delete(session).where(eq(session.userId, input.targetId))

  const fk = await loadDrainRow(database, input.targetId)
  const hasPhotos = fk ? await hasPhotosLeft(database, input.targetId) : false
  await applyDrainTransition(
    database,
    input.targetId,
    planBanDrain(fk, hasPhotos, now),
    now
  )

  const names = await loadNames(database, [input.actorId, input.targetId])
  await logUserBanActivity({
    action: 'banned',
    userId: input.targetId,
    userName: names.get(input.targetId) ?? input.targetId,
    actorName: names.get(input.actorId) ?? 'admin',
    reason: check.reason,
  })

  try {
    await finishBanWork(database)
  } catch (error) {
    console.error('Ban follow-up failed, cron will continue:', error)
  }
}

export async function unbanUser(
  database: Database,
  input: { actorId: string; targetId: string }
): Promise<void> {
  const target = await database
    .select({ bannedAt: user.bannedAt })
    .from(user)
    .where(eq(user.id, input.targetId))
    .get()
  if (!target) throw new Error('User not found')
  if (!target.bannedAt) throw new Error('User is not banned')

  await database
    .update(user)
    .set({
      bannedAt: null,
      banReason: null,
      bannedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, input.targetId))

  const names = await loadNames(database, [input.actorId, input.targetId])
  await logUserBanActivity({
    action: 'unbanned',
    userId: input.targetId,
    userName: names.get(input.targetId) ?? input.targetId,
    actorName: names.get(input.actorId) ?? 'admin',
  })
}
