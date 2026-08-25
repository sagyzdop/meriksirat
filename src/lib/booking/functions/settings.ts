import { createServerFn } from '@tanstack/react-start'
import type { BookingSettings } from '@/lib/booking/types'

export const getBookingSettingsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BookingSettings> => {
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { settings } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const database = db(env.meriksirat_d1 as D1Database)

    // Get or create default settings
    let settingsRecord = await database
      .select()
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get()

    // If no settings exist, create default
    if (!settingsRecord) {
      const [newSettings] = await database
        .insert(settings)
        .values({
          id: 'global',
          globalBookingNote: '',
          operatingHoursStart: 0,
          operatingHoursEnd: 1439,
        })
        .returning()

      settingsRecord = newSettings
    }

    return {
      globalBookingNote: settingsRecord.globalBookingNote || '',
      operatingHoursStart: settingsRecord.operatingHoursStart || 0,
      operatingHoursEnd: settingsRecord.operatingHoursEnd || 1439,
    }
  }
)

// Helper to convert minutes since midnight to HH:MM format
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

// Helper to convert HH:MM to minutes since midnight
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
