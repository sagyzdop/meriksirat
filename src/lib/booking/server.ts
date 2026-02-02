import { env } from 'cloudflare:workers'
import { db } from '@/db/index'
import { equipment } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function getEquipmentCalendarId(equipmentId: number): Promise<string | null> {
  const database = db(env.meriksirat_d1 as D1Database)
  const equipmentData = await database
    .select({ googleCalendarId: equipment.googleCalendarId })
    .from(equipment)
    .where(eq(equipment.id, equipmentId))
    .get()
  
  return equipmentData?.googleCalendarId || null
}

export async function retry<T>(fn: () => Promise<T>, retries = 3, backoffMs = 300): Promise<T> {
  let lastErr: any
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      // exponential-ish backoff
      await new Promise((r) => setTimeout(r, backoffMs * (i + 1)))
    }
  }
  throw lastErr
}
