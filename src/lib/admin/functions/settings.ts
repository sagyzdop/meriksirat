import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

/**
 * Schema for updating system settings
 */
export const UpdateSettingsSchema = z.object({
  globalBookingNote: z.string().optional(),
  birthdaysCalendarId: z.string().optional(),
  operatingHoursStart: z.number().min(0).max(1439).optional(),
  operatingHoursEnd: z.number().min(0).max(1439).optional(),
  bufferLimitBytes: z.number().min(1).max(1_000_000).optional(),
  bufferAlertPercent: z.number().int().min(1).max(100).optional(),
  albumDeletionNoticeDays: z.number().int().min(1).max(365).optional(),
  poolLowAlertPercent: z.number().int().min(1).max(100).optional(),
  lostGraceDays: z.number().int().min(1).max(365).optional(),
  graduationPromptDays: z.number().int().min(1).max(730).optional(),
})

/** The global settings row as returned by getSettingsFn. */
export interface SettingsData {
  id: string
  globalBookingNote: string | null
  birthdaysCalendarId: string | null
  operatingHoursStart: number | null
  operatingHoursEnd: number | null
  bufferLimitBytes: number
  bufferAlertPercent: number
  albumDeletionNoticeDays: number
  poolLowAlertPercent: number
  lostGraceDays: number
  graduationPromptDays: number
  createdAt: Date | null
  updatedAt: Date | null
}

/**
 * Get system settings
 * Returns the global settings or creates default if not exists
 */
export const getSettingsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { adminContext } = await import('../server')
    const { loadSettings } = await import('@/lib/booking/load-settings')

    const { database } = await adminContext(['admin', 'manager'])

    const settingsData = await loadSettings(database)

    const { clubCode: _clubCode, ...publicSettings } = settingsData
    return publicSettings
  }
)

/**
 * Update system settings
 * Only updates provided fields, leaves others unchanged
 */
export const updateSettingsFn = createServerFn({ method: 'POST' })
  .validator(UpdateSettingsSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('../server')
    const { settings } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    // Validate operating hours if both are provided
    if (
      data.operatingHoursStart !== undefined &&
      data.operatingHoursEnd !== undefined &&
      data.operatingHoursStart >= data.operatingHoursEnd
    ) {
      throw new Error('Operating hours start must be before end time')
    }

    // Check if settings exist
    const existingSettings = await database
      .select()
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get()

    if (!existingSettings) {
      // Create new settings if they don't exist
      const result = await database
        .insert(settings)
        .values({
          id: 'global',
          globalBookingNote: data.globalBookingNote ?? '',
          operatingHoursStart: data.operatingHoursStart ?? 0,
          operatingHoursEnd: data.operatingHoursEnd ?? 1439,
        })
        .returning()

      return result[0]
    }

    // Update existing settings
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.globalBookingNote !== undefined) {
      updateData.globalBookingNote = data.globalBookingNote
    }
    if (data.birthdaysCalendarId !== undefined) {
      updateData.birthdaysCalendarId = data.birthdaysCalendarId
    }
    if (data.operatingHoursStart !== undefined) {
      updateData.operatingHoursStart = data.operatingHoursStart
    }
    if (data.operatingHoursEnd !== undefined) {
      updateData.operatingHoursEnd = data.operatingHoursEnd
    }
    if (data.bufferLimitBytes !== undefined) {
      const { gbToBytes } = await import('@/lib/flamekeeper/rules')
      const { getBufferUsage } = await import('@/lib/buffer/usage-server')
      const limitBytes = Math.round(gbToBytes(data.bufferLimitBytes))
      const usage = await getBufferUsage(10 * 60 * 1000)
      if (usage && limitBytes < usage.usedBytes) {
        throw new Error(
          'The buffer ceiling cannot be lower than the space already used'
        )
      }
      updateData.bufferLimitBytes = limitBytes
    }
    for (const key of [
      'bufferAlertPercent',
      'albumDeletionNoticeDays',
      'poolLowAlertPercent',
      'lostGraceDays',
      'graduationPromptDays',
    ] as const) {
      if (data[key] !== undefined) updateData[key] = data[key]
    }

    const result = await database
      .update(settings)
      .set(updateData)
      .where(eq(settings.id, 'global'))
      .returning()

    return result[0]
  })
