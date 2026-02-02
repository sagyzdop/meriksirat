import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { 
  PaginatedAdminBookingsResponse,
  AdminBookingWithDetails
} from '../types'
import {
  AdminBookingFiltersSchema,
  UpdateBookingStatusAdminSchema,
  GetBookingByIdSchema,
} from '../types'

/**
 * Get all bookings with comprehensive filtering and pagination for admin oversight
 * Includes user and equipment details for administrative management
 */
export const getAdminBookingsFn = createServerFn({ method: 'GET' })
  .inputValidator(AdminBookingFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedAdminBookingsResponse> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, user } = await import('@/db/schema')
    const { eq, and, or, gte, lt, like, sql, desc } = await import('drizzle-orm')
    
    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Build where conditions
    const conditions = []

    if (data.status) {
      conditions.push(eq(booking.status, data.status))
    }

    if (data.userId) {
      conditions.push(eq(booking.userId, data.userId))
    }

    if (data.equipmentId) {
      conditions.push(eq(booking.equipmentId, data.equipmentId))
    }

    if (data.startDate) {
      conditions.push(gte(booking.startTime, new Date(data.startDate)))
    }

    if (data.endDate) {
      conditions.push(lt(booking.endTime, new Date(data.endDate)))
    }

    // Search functionality across user names, emails, and equipment names
    if (data.search) {
      const searchTerm = `%${data.search}%`
      conditions.push(
        or(
          like(user.name, searchTerm),
          like(user.email, searchTerm),
          like(user.firstName, searchTerm),
          like(user.lastName, searchTerm),
          like(equipment.modelName, searchTerm)
        )
      )
    }

    const whereClause = conditions.length === 0 ? undefined : 
      conditions.length === 1 ? conditions[0] : and(...conditions)

    // Get total count for pagination
    const totalCountResult = await database
      .select({ count: sql<number>`count(*)` })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(whereClause)

    const total = totalCountResult[0]?.count || 0
    const totalPages = Math.ceil(total / data.limit)
    const offset = (data.page - 1) * data.limit

    // Get paginated bookings list with user and equipment details
    const bookingsList = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        googleCalendarEventId: booking.googleCalendarEventId,
        userEventDetails: booking.userEventDetails,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        equipment: {
          id: equipment.id,
          modelName: equipment.modelName,
          description: equipment.description,
          categoryId: equipment.categoryId,
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(whereClause)
      .orderBy(desc(booking.startTime))
      .limit(data.limit)
      .offset(offset)

    const response: PaginatedAdminBookingsResponse = {
      data: bookingsList as AdminBookingWithDetails[],
      pagination: {
        page: data.page,
        limit: data.limit,
        total,
        totalPages,
        hasNext: data.page < totalPages,
        hasPrev: data.page > 1,
      }
    }

    return response
  })

/**
 * Get booking details by ID for admin oversight
 * Includes user and equipment details for administrative management
 */
export const getAdminBookingByIdFn = createServerFn({ method: 'GET' })
  .inputValidator(GetBookingByIdSchema)
  .handler(async ({ data }): Promise<AdminBookingWithDetails | null> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    
    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    const bookingItem = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        googleCalendarEventId: booking.googleCalendarEventId,
        userEventDetails: booking.userEventDetails,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        equipment: {
          id: equipment.id,
          modelName: equipment.modelName,
          description: equipment.description,
          categoryId: equipment.categoryId,
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const result = bookingItem[0] as AdminBookingWithDetails | undefined

    return result || null
  })

/**
 * Update booking status with admin privileges and Google Calendar integration
 * Includes administrative notes capability and calendar synchronization
 */
export const updateBookingStatusAdminFn = createServerFn({ method: 'POST' })
  .inputValidator(UpdateBookingStatusAdminSchema)
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { deleteCalendarEvent, updateCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    
    const headers = getRequestHeaders()
    const adminUser = await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Get the booking with user and equipment details
    const bookingItem = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        googleCalendarEventId: booking.googleCalendarEventId,
        userEventDetails: booking.userEventDetails,
        user: {
          email: user.email,
        },
        equipment: {
          modelName: equipment.modelName,
          googleCalendarId: equipment.googleCalendarId,
        },
      })
      .from(booking)
      .leftJoin(user, eq(booking.userId, user.id))
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const bookingData = bookingItem[0]

    if (!bookingData) {
      throw new Error('Booking not found')
    }

    const previousStatus = bookingData.status

    // Update booking status and notes (admin notes will be appended to userEventDetails)
    const updatedNotes = data.notes 
      ? `${bookingData.userEventDetails || ''}\n\n[Admin Note by ${adminUser.email}]: ${data.notes}`.trim()
      : bookingData.userEventDetails

    await database
      .update(booking)
      .set({
        status: data.status,
        userEventDetails: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, data.bookingId))

    // Log booking status change to Telegram channel
    try {
      await logBookingActivityById(data.bookingId, 'updated', {
        previousStatus,
        newStatus: data.status,
        notes: `Admin ${adminUser.email} changed status from ${previousStatus} to ${data.status}${data.notes ? `. Notes: ${data.notes}` : ''}`
      })
    } catch (logError) {
      console.error('Failed to log booking status update:', logError)
    }

    // Handle Google Calendar integration based on status change
    if (bookingData.googleCalendarEventId && bookingData.equipment?.googleCalendarId) {
      try {
        if (data.status === 'cancelled') {
          // Delete calendar event for cancelled bookings
          await deleteCalendarEvent({
            data: {
              equipmentCalendarId: bookingData.equipment.googleCalendarId,
              eventId: bookingData.googleCalendarEventId,
            }
          })
        } else {
          // Update calendar event with new status and admin notes
          // Get global booking note from settings
          const { settings } = await import('@/db/schema')
          const settingsData = await database
            .select({ globalBookingNote: settings.globalBookingNote })
            .from(settings)
            .where(eq(settings.id, 'global'))
            .get()

          const globalNote = settingsData?.globalBookingNote
          const descriptionParts = [
            `Booking ID: ${data.bookingId}`,
            `User: ${bookingData.user?.email}`,
            `Status: ${data.status}`,
            `Notes: ${updatedNotes || 'No notes'}`
          ]
          
          if (globalNote && globalNote.trim()) {
            descriptionParts.push('', '---', globalNote)
          }

          const event = {
            summary: `${bookingData.equipment.modelName || `Equipment ${bookingData.equipmentId}`} - Booking (${data.status.toUpperCase()})`,
            description: descriptionParts.join('\n'),
            start: { dateTime: bookingData.startTime.toISOString(), timeZone: 'UTC' },
            end: { dateTime: bookingData.endTime.toISOString(), timeZone: 'UTC' },
          }

          await updateCalendarEvent({
            data: {
              equipmentCalendarId: bookingData.equipment.googleCalendarId,
              eventId: bookingData.googleCalendarEventId,
              event,
              userEmail: bookingData.user?.email || '',
            }
          })
        }
      } catch (calendarError) {
        console.error('Failed to update calendar event:', calendarError)
      }
    }

    return { success: true, previousStatus, newStatus: data.status }
  })
