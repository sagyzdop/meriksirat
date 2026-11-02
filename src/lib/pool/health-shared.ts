import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { flamekeeper } from '@/db/schema'

type Database = ReturnType<typeof db>

const IN_CHUNK = 90

export interface HealthEnv {
  meriksirat_d1: D1Database
  TELEGRAM_BOT_TOKEN?: string
  BETTER_AUTH_URL?: string
}

export function chunked<T>(items: T[], size: number = IN_CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
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
