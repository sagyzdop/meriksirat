import { eq } from 'drizzle-orm'
import type { db } from '@/db'
import { settings } from '@/db/schema'

export async function loadSettings(database: ReturnType<typeof db>) {
  const existing = await database
    .select()
    .from(settings)
    .where(eq(settings.id, 'global'))
    .get()
  if (existing) return existing

  const [created] = await database
    .insert(settings)
    .values({
      id: 'global',
      globalBookingNote: '',
      operatingHoursStart: 0,
      operatingHoursEnd: 1439,
    })
    .returning()
  return created
}
