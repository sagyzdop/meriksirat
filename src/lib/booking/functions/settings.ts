import { createServerFn } from '@tanstack/react-start'
import type { BookingSettings } from '@/lib/booking/types'

export const getBookingSettingsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BookingSettings> => {
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { loadSettings } = await import('../load-settings')

    const settingsRecord = await loadSettings(
      db(env.meriksirat_d1 as D1Database)
    )

    return {
      globalBookingNote: settingsRecord.globalBookingNote || '',
      operatingHoursStart: settingsRecord.operatingHoursStart || 0,
      operatingHoursEnd: settingsRecord.operatingHoursEnd || 1439,
    }
  }
)
