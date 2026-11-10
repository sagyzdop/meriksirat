import { and, eq, ne } from 'drizzle-orm'
import type { Database } from '@/db'
import { flamekeeper, user, volume } from '@/db/schema'
import { dropFlamekeeperGrant } from '@/lib/flamekeeper/tokens'
import { MIN_PLEDGE_BYTES, formatGb } from '@/lib/flamekeeper/rules'
import type { StopStatus } from '@/lib/flamekeeper/types'
import { siteOrigin } from '@/lib/format'
import { graduationDateError } from '@/lib/graduation-date'
import { loadSettings } from '@/lib/booking/load-settings'
import { planGraduation } from './graduation'
import { planEnd, planOptOut, type StopPlan, type StopReason } from './stop'
import { UserError } from '@/lib/user-error'

export async function loadFlamekeeperState(database: Database, userId: string) {
  const row = await database
    .select({ state: flamekeeper.state })
    .from(flamekeeper)
    .where(eq(flamekeeper.userId, userId))
    .get()
  return row ?? null
}

export async function endFlamekeeping(
  database: Database,
  userId: string,
  now: Date = new Date()
): Promise<'draining' | 'drained'> {
  const held = await database
    .select({ id: volume.id })
    .from(volume)
    .where(eq(volume.flamekeeperUserId, userId))
    .limit(1)
    .get()
  if (planEnd(held ? 1 : 0) === 'draining') {
    await database
      .update(flamekeeper)
      .set({ state: 'draining', updatedAt: now })
      .where(and(eq(flamekeeper.userId, userId), ne(flamekeeper.state, 'lost')))
    return 'draining'
  }
  await dropFlamekeeperGrant(database, userId)
  await database
    .update(flamekeeper)
    .set({
      state: 'drained',
      usedBytes: 0,
      driveUsageBytes: 0,
      updatedAt: now,
    })
    .where(eq(flamekeeper.userId, userId))
  return 'drained'
}

export async function applyStopPlan(
  database: Database,
  userId: string,
  plan: StopPlan,
  now: Date = new Date()
): Promise<boolean> {
  switch (plan.kind) {
    case 'stop':
      await endFlamekeeping(database, userId, now)
      return true
    case 'refuse':
      throw new UserError(plan.message)
    case 'none':
      return false
  }
}

export async function optOutFlamekeeper(
  database: Database,
  userId: string,
  now: Date = new Date()
): Promise<StopStatus> {
  const row = await loadFlamekeeperState(database, userId)
  if (!row) throw new UserError('You are not a flamekeeper')
  const stopped = await applyStopPlan(database, userId, planOptOut(row), now)
  if (!stopped) return { state: row.state }
  return { state: (await loadFlamekeeperState(database, userId))!.state }
}

export async function changePledge(
  database: Database,
  userId: string,
  input: { pledgedBytes: number; graduationDate: string },
  now: Date = new Date()
): Promise<void> {
  const row = await database
    .select({
      state: flamekeeper.state,
      pledgedBytes: flamekeeper.pledgedBytes,
    })
    .from(flamekeeper)
    .where(eq(flamekeeper.userId, userId))
    .get()
  if (!row) throw new UserError('You are not a flamekeeper')
  if (
    input.pledgedBytes < MIN_PLEDGE_BYTES &&
    input.pledgedBytes < row.pledgedBytes
  ) {
    throw new UserError(`Pledge at least ${formatGb(MIN_PLEDGE_BYTES)}`)
  }
  await database.batch([
    database
      .update(flamekeeper)
      .set({
        pledgedBytes: input.pledgedBytes,
        graduationConfirmedAt: now,
        updatedAt: now,
      })
      .where(eq(flamekeeper.userId, userId)),
    database
      .update(user)
      .set({ graduationDate: input.graduationDate, updatedAt: now })
      .where(eq(user.id, userId)),
  ])
  const { graduationPromptDays } = await loadSettings(database)
  await applyStopPlan(
    database,
    userId,
    planGraduation(row, input.graduationDate, now, graduationPromptDays),
    now
  )
}

export async function saveGraduationDate(
  database: Database,
  userId: string,
  graduationDate: string,
  now: Date = new Date()
): Promise<void> {
  const row = await database
    .select({
      state: flamekeeper.state,
      pledgedBytes: flamekeeper.pledgedBytes,
    })
    .from(flamekeeper)
    .where(eq(flamekeeper.userId, userId))
    .get()
  const current = await database
    .select({ graduationDate: user.graduationDate })
    .from(user)
    .where(eq(user.id, userId))
    .get()
  const error = graduationDateError(
    graduationDate,
    {
      isFlamekeeper: !!row && row.state !== 'drained',
      current: current?.graduationDate,
    },
    now
  )
  if (error) throw new UserError(error)
  if (row && row.state !== 'drained') {
    await changePledge(
      database,
      userId,
      { pledgedBytes: row.pledgedBytes, graduationDate },
      now
    )
    return
  }
  await database
    .update(user)
    .set({ graduationDate, updatedAt: now })
    .where(eq(user.id, userId))
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
  return origin ? `\n\nOpen your account page: ${origin}/account` : ''
}

const ENDED_WHY: Partial<Record<StopReason, string>> = {
  graduation: 'Your expected graduation date is less than 60 days away',
  domain:
    'Your account is no longer an @nu.edu.kz account, so it cannot keep lending storage',
}

export async function sendFlamekeepingEndedEmail(
  database: Database,
  userId: string,
  reason: StopReason
): Promise<void> {
  const why = ENDED_WHY[reason]
  if (!why) return
  await sendFlamekeeperEmail(
    database,
    userId,
    '#savenuimg: your flamekeeping has ended',
    (name) =>
      `Hi ${name},\n\n${why}, so your flamekeeping has ended and the app has removed its access to your Drive. There is nothing to do on your side.${accountLink()}\n\nThank you for keeping the flame.`
  )
}
