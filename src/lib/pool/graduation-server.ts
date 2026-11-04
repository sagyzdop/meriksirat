import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { flamekeeper, user } from '@/db/schema'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { formatLongDate } from '@/lib/club-time'
import {
  accountLink,
  applyDrainTransition,
  drainColumns,
  hasPhotosLeft,
  sendDrainStartedEmail,
  type DrainRow,
} from './drain-server'
import {
  graduationPromptEmailDue,
  planDomainChange,
  planGraduation,
} from './graduation'
import type { DrainTransition } from './drain'

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
      ...drainColumns,
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
    .where(inArray(flamekeeper.state, ['active', 'full', 'draining']))
    .all()

  let triggers = 0
  const started = new Set<string>()
  for (const row of rows) {
    if (triggers >= TRIGGERS_PER_RUN) break
    const needsPhotoCheck = row.usedBytes > 0
    let plan: DrainTransition = planDomainChange(row, row.email, now, true)
    if (plan.kind === 'none' && row.graduationDate) {
      plan = planGraduation(row, row.graduationDate, now, true)
    }
    if (plan.kind !== 'drain' && plan.kind !== 'drained') continue
    if (!takeIfBudgeted(budget, 2)) break
    triggers++
    try {
      if (plan.kind === 'drained' || !needsPhotoCheck) {
        plan = { kind: 'drained' }
      } else if (
        !(await hasPhotosLeft(database, row.userId, { includeDropped: true }))
      ) {
        plan = { kind: 'drained' }
      }
      await applyDrainTransition(database, row.userId, plan, now, budget)
      if (plan.kind === 'drain') {
        started.add(row.userId)
        const updated: DrainRow = {
          ...row,
          state: 'draining',
          drainReason: plan.drainReason,
          drainingDeadline: plan.drainingDeadline,
        }
        await sendDrainStartedEmail(database, updated)
      }
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
      started.has(row.userId) ||
      !graduationPromptEmailDue(row, now)
    )
      continue
    if (!takeIfBudgeted(budget, 1)) break
    prompts++
    const sent = await sendEmail({
      to: row.email,
      subject: '#savenuimg: is your graduation date still right?',
      text: `Hi ${row.firstName || row.name},\n\nWe have your expected graduation date as ${formatLongDate(new Date(`${row.graduationDate}T00:00:00Z`), 'UTC')}. Photos you hold are moved to other flamekeepers 60 days before it, so please confirm it is still right or change it.${accountLink()}\n\nThank you for keeping the flame.`,
    })
    if (sent) {
      await database
        .update(flamekeeper)
        .set({ graduationPromptSentAt: now })
        .where(eq(flamekeeper.userId, row.userId))
    }
  }
}
