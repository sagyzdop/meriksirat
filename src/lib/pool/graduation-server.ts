import { eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { flamekeeper, user } from '@/db/schema'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { formatLongDate } from '@/lib/club-time'
import {
  accountLink,
  endFlamekeeping,
  sendFlamekeepingEndedEmail,
} from './stop-server'
import {
  graduationPromptEmailDue,
  planDomainChange,
  planGraduation,
} from './graduation'
import type { StopReason } from './stop'

const TRIGGERS_PER_RUN = 3
const PROMPTS_PER_RUN = 2

export async function runGraduationMaintenance(
  env: { meriksirat_d1: D1Database },
  budget?: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  const rows = await database
    .select({
      userId: flamekeeper.userId,
      state: flamekeeper.state,
      graduationDate: user.graduationDate,
      graduationConfirmedAt: flamekeeper.graduationConfirmedAt,
      graduationPromptSentAt: flamekeeper.graduationPromptSentAt,
      createdAt: flamekeeper.createdAt,
      email: user.email,
      firstName: user.firstName,
      name: user.name,
    })
    .from(flamekeeper)
    .innerJoin(user, eq(user.id, flamekeeper.userId))
    .where(ne(flamekeeper.state, 'drained'))
    .all()

  let triggers = 0
  const stopped = new Set<string>()
  for (const row of rows) {
    if (triggers >= TRIGGERS_PER_RUN) break
    let reason: StopReason | null = null
    if (planDomainChange(row, row.email).kind === 'stop') reason = 'domain'
    else if (
      row.graduationDate &&
      planGraduation(row, row.graduationDate, now).kind === 'stop'
    ) {
      reason = 'graduation'
    }
    if (!reason) continue
    if (!takeIfBudgeted(budget, 3)) break
    triggers++
    try {
      await endFlamekeeping(database, row.userId, now)
      stopped.add(row.userId)
      await sendFlamekeepingEndedEmail(database, row.userId, reason)
    } catch (error) {
      console.error(`Graduation trigger failed for ${row.userId}:`, error)
    }
  }

  const { sendEmail } = await import('@/lib/google/email')
  let prompts = 0
  for (const row of rows) {
    if (prompts >= PROMPTS_PER_RUN) break
    if (
      !row.graduationDate ||
      stopped.has(row.userId) ||
      !graduationPromptEmailDue(row, now)
    )
      continue
    if (!takeIfBudgeted(budget, 1)) break
    prompts++
    const sent = await sendEmail({
      to: row.email,
      subject: '#savenuimg: is your graduation date still right?',
      text: `Hi ${row.firstName || row.name},\n\nWe have your expected graduation date as ${formatLongDate(new Date(`${row.graduationDate}T00:00:00Z`), 'UTC')}. Your flamekeeping ends 60 days before it, so please confirm it is still right or change it.${accountLink()}\n\nThank you for keeping the flame.`,
    })
    if (sent) {
      await database
        .update(flamekeeper)
        .set({ graduationPromptSentAt: now })
        .where(eq(flamekeeper.userId, row.userId))
    }
  }
}
