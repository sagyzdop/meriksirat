import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

/**
 * Schema for updating system settings
 */
export const UpdateSettingsSchema = z.object({
  globalBookingNote: z.string().optional(),
  operatingHoursStart: z.number().min(0).max(1439).optional(),
  operatingHoursEnd: z.number().min(0).max(1439).optional(),
})

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>

/**
 * Get system settings
 * Returns the global settings or creates default if not exists
 */
export const getSettingsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { checkAdminPermission } = await import('../server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { settings } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    
    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])
    
    const database = db(env.meriksirat_d1 as D1Database)
    
    // Try to get existing settings
    let settingsData = await database
      .select()
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get()
    
    // If no settings exist, create default settings
    if (!settingsData) {
      const result = await database
        .insert(settings)
        .values({
          id: 'global',
          globalBookingNote: '',
          operatingHoursStart: 0,
          operatingHoursEnd: 1439,
        })
        .returning()
      
      settingsData = result[0]
    }
    
    return settingsData
  })

/**
 * Update system settings
 * Only updates provided fields, leaves others unchanged
 */
export const updateSettingsFn = createServerFn({ method: 'POST' })
  .inputValidator(UpdateSettingsSchema)
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('../server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { settings } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    
    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])
    
    const database = db(env.meriksirat_d1 as D1Database)
    
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
    if (data.operatingHoursStart !== undefined) {
      updateData.operatingHoursStart = data.operatingHoursStart
    }
    if (data.operatingHoursEnd !== undefined) {
      updateData.operatingHoursEnd = data.operatingHoursEnd
    }
    
    const result = await database
      .update(settings)
      .set(updateData)
      .where(eq(settings.id, 'global'))
      .returning()
    
    return result[0]
  })
