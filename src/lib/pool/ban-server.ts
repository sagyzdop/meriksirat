import { and, eq, inArray, isNotNull, ne } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { booking, flamekeeper, session, user } from '@/db/schema'
import { isMasterEmail } from '@/lib/flamekeeper/master'
import { cancelWholeBooking } from '@/lib/booking/booking-items'
import {
  logBookingActivityById,
  logUserBanActivity,
} from '@/lib/telegram/logging'
import { formatUserDisplayName } from '@/lib/utils'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { checkBan } from './ban'
import { planBan } from './stop'
import {
  applyStopPlan,
  endFlamekeeping,
  loadFlamekeeperState,
} from './stop-server'

const CANCELS_PER_RUN = 3
const STOPS_PER_RUN = 10

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
      const proceeded = await cancelWholeBooking(database, id, (itemCount) =>
        takeIfBudgeted(budget, itemCount + 2)
      )
      if (!proceeded) return
      await logBookingActivityById(id, 'cancelled', {
        actorName: 'system',
        reason: 'Account banned',
      })
    } catch (error) {
      console.error(`Failed to cancel booking ${id} for a ban:`, error)
    }
  }
}

async function stopBannedFlamekeepers(
  database: Database,
  budget?: Budget
): Promise<void> {
  const banned = await database
    .select({ userId: flamekeeper.userId })
    .from(flamekeeper)
    .innerJoin(user, eq(user.id, flamekeeper.userId))
    .where(and(isNotNull(user.bannedAt), ne(flamekeeper.state, 'drained')))
    .limit(STOPS_PER_RUN)
    .all()
  for (const { userId } of banned) {
    if (!takeIfBudgeted(budget, 2)) return
    try {
      await endFlamekeeping(database, userId)
    } catch (error) {
      console.error(`Failed to stop banned flamekeeper ${userId}:`, error)
    }
  }
}

async function finishBanWork(
  database: Database,
  budget?: Budget
): Promise<void> {
  await cancelBannedBookings(database, budget)
  await stopBannedFlamekeepers(database, budget)
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

  const fk = await loadFlamekeeperState(database, input.targetId)
  await applyStopPlan(database, input.targetId, planBan(fk), now)

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
