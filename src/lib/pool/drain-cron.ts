import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { flamekeeper } from '@/db/schema'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { endFlamekeeping } from './stop-server'

const SETTLES_PER_RUN = 10

export async function runDrainMaintenance(
  env: { meriksirat_d1: D1Database },
  budget?: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const leftover = await database
    .select({ userId: flamekeeper.userId })
    .from(flamekeeper)
    .where(eq(flamekeeper.state, 'draining'))
    .limit(SETTLES_PER_RUN)
    .all()

  for (const { userId } of leftover) {
    if (!takeIfBudgeted(budget, 2)) break
    try {
      await endFlamekeeping(database, userId)
    } catch (error) {
      console.error(`Could not settle old drain of ${userId}:`, error)
    }
  }
}
