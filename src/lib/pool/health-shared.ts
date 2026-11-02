import { eq, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { flamekeeper } from '@/db/schema'

export const IN_CHUNK = 90

export interface HealthEnv {
  meriksirat_d1: D1Database
  TELEGRAM_BOT_TOKEN?: string
  BETTER_AUTH_URL?: string
}

export async function adjustUsedBytes(
  database: Database,
  userId: string,
  delta: number
): Promise<void> {
  if (delta === 0) return
  await database
    .update(flamekeeper)
    .set({ usedBytes: sql`MAX(${flamekeeper.usedBytes} + ${delta}, 0)` })
    .where(eq(flamekeeper.userId, userId))
}
