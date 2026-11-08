import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { flamekeeper, flamekeeperGrant, user } from '@/db/schema'
import { type Budget } from '@/lib/cron/budget'
import { loadSettings } from '@/lib/booking/load-settings'
import { siteOrigin } from '@/lib/format'
import {
  FlamekeeperGrantError,
  forgetFlamekeeperAccessToken,
  getFlamekeeperAccessToken,
} from '@/lib/flamekeeper/tokens'
import { getDriveAbout } from '@/lib/google/google-drive'
import {
  DAY_MS,
  HEALTH_CHECK_COST,
  HEALTH_INTERVAL_MS,
  HEALTH_STEP_CAP,
  canBecomeLost,
  isUniqueConstraintError,
  planEmailSync,
  planHealthBatch,
  planLost,
} from './health'
import { finalizeLost, sendReconnectEmails } from './lost-server'
import type { HealthEnv } from './health-shared'

const RETRY_AFTER_TRANSIENT_MS = 60 * 60 * 1000

let warnedNoAboutUser = false

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

async function syncEmail(
  database: Database,
  userId: string,
  saved: string,
  reported: string | null
): Promise<void> {
  if (reported === null && !warnedNoAboutUser) {
    warnedNoAboutUser = true
    console.warn(
      'Drive about.get returned no user.emailAddress under drive.file; skipping the email sync'
    )
  }
  const plan = planEmailSync(saved, reported)
  if (plan.kind !== 'update') return
  try {
    await database
      .update(user)
      .set({ email: plan.email!, updatedAt: new Date() })
      .where(eq(user.id, userId))
    console.log(`Synced email of flamekeeper ${userId} from Google`)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      console.error(
        `Google email for flamekeeper ${userId} is already used by another account; left unchanged`
      )
    } else {
      console.error(`Failed to sync email for ${userId}:`, error)
    }
  }
}

async function checkGrants(
  database: Database,
  now: Date,
  budget: Budget
): Promise<void> {
  const step = budget.sub(HEALTH_STEP_CAP)

  const candidates = await database
    .select({
      userId: flamekeeper.userId,
      email: user.email,
      state: flamekeeper.state,
      healthCheckedAt: flamekeeper.healthCheckedAt,
    })
    .from(flamekeeper)
    .innerJoin(user, eq(user.id, flamekeeper.userId))
    .where(inArray(flamekeeper.state, ['active', 'full', 'draining']))
    .all()

  const picked = planHealthBatch(candidates, now, step.remaining())

  for (const userId of picked) {
    const row = candidates.find((c) => c.userId === userId)!
    if (!step.take(HEALTH_CHECK_COST)) break
    forgetFlamekeeperAccessToken(userId)
    try {
      const token = await getFlamekeeperAccessToken(database, userId)
      await database
        .update(flamekeeperGrant)
        .set({ lastRefreshAt: now })
        .where(eq(flamekeeperGrant.userId, userId))
      const about = await getDriveAbout(token)
      await database
        .update(flamekeeper)
        .set(
          about.usageInDrive === null
            ? { driveUsageCheckedAt: now, healthCheckedAt: now }
            : {
                driveUsageBytes: about.usageInDrive,
                driveUsageCheckedAt: now,
                healthCheckedAt: now,
              }
        )
        .where(eq(flamekeeper.userId, userId))
      await syncEmail(database, userId, row.email, about.email)
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
}

export async function runFlamekeeperHealth(
  env: HealthEnv,
  budget: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  await checkGrants(database, now, budget)

  const settingsRow = await loadSettings(database)
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
    now,
    settingsRow.lostGraceDays * DAY_MS
  )

  const origin = siteOrigin(env.BETTER_AUTH_URL)
  await sendReconnectEmails(database, plan.notify, origin, now, budget)

  for (const userId of plan.finalize) {
    await finalizeLost(database, userId, now)
  }
}
