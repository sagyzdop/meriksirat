import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { flamekeeper, photo, user, volume } from '@/db/schema'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import {
  applyDrainTransition,
  drainColumns,
  sendDrainStartedEmail,
  type DrainRow,
} from './drain-server'
import {
  graduationPromptEmailDue,
  planDomainChange,
  planGraduation,
} from './graduation'
import type { DrainTransition } from './drain'

type Database = ReturnType<typeof db>

const TRIGGERS_PER_RUN = 3
const PROMPTS_PER_RUN = 2

async function holdsPhotos(
  database: Database,
  userId: string
): Promise<boolean> {
  const pending = await database
    .select({ albumId: volume.albumId })
    .from(volume)
    .where(
      and(eq(volume.flamekeeperUserId, userId), isNotNull(volume.droppedAt))
    )
    .limit(1)
    .get()
  if (pending) return true
  const row = await database
    .select({ id: photo.id })
    .from(volume)
    .innerJoin(
      photo,
      and(
        eq(photo.albumId, volume.albumId),
        eq(photo.flamekeeperUserId, volume.flamekeeperUserId)
      )
    )
    .where(and(eq(volume.flamekeeperUserId, userId), eq(photo.state, 'live')))
    .limit(1)
    .get()
  return !!row
}

function formatDay(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function profileLink(): string {
  const origin = (process.env.BETTER_AUTH_URL ?? '').trim().replace(/\/+$/, '')
  return origin ? `\n\nOpen your account page: ${origin}/profile` : ''
}

export async function runGraduationMaintenance(
  env: { meriksirat_d1: D1Database },
  budget?: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  const rows = await database
    .select({
      ...drainColumns,
      graduationDate: flamekeeper.graduationDate,
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
    if (plan.kind === 'none') {
      plan = planGraduation(row, row.graduationDate, now, true)
    }
    if (plan.kind !== 'drain' && plan.kind !== 'drained') continue
    if (!takeIfBudgeted(budget, 2)) break
    triggers++
    try {
      if (plan.kind === 'drained' || !needsPhotoCheck) {
        plan = { kind: 'drained' }
      } else if (!(await holdsPhotos(database, row.userId))) {
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
    if (started.has(row.userId) || !graduationPromptEmailDue(row, now)) continue
    if (!takeIfBudgeted(budget, 1)) break
    prompts++
    const sent = await sendEmail({
      to: row.email,
      subject: '#savenuimg: is your graduation date still right?',
      text: `Hi ${row.firstName || row.name},\n\nWe have your expected graduation date as ${formatDay(row.graduationDate)}. Photos you hold are moved to other flamekeepers 60 days before it, so please confirm it is still right or change it.${profileLink()}\n\nThank you for keeping the flame.`,
    })
    if (sent) {
      await database
        .update(flamekeeper)
        .set({ graduationPromptSentAt: now })
        .where(eq(flamekeeper.userId, row.userId))
    }
  }
}
