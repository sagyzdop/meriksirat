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
  DeleteBookingSchema,
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
    const { booking, equipment, user, category } = await import('@/db/schema')
    const { eq, and, sql, desc, asc, inArray } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Build where conditions
    const conditions = []

    if (data.status && data.status.length > 0) {
      conditions.push(inArray(booking.status, data.status))
    }

    const whereClause = conditions.length === 0 ? undefined :
      conditions.length === 1 ? conditions[0] : and(...conditions)

    // Get total count for pagination - join only if needed for filtering
    // In this case, we only filter by booking status, so no joins needed for count
    const countQuery = database
      .select({ count: sql<number>`count(*)` })
      .from(booking)

    if (whereClause) {
      countQuery.where(whereClause)
    }

    const offset = (data.page - 1) * data.limit

    // Apply sorting
    const sortColumn = (() => {
      switch (data.sortBy) {
        case 'startTime':
          return booking.startTime
        case 'endTime':
          return booking.endTime
        case 'status':
          return booking.status
        case 'createdAt':
          return booking.createdAt
        case 'equipment':
          return equipment.modelName
        case 'user':
          return user.email
        default:
          return booking.startTime
      }
    })()

    const orderBy = data.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)

    // Main data query
    const bookingsQuery = database
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
          imagePath: equipment.imagePath,
          googleCalendarId: equipment.googleCalendarId,
          category: {
            id: category.id,
            name: category.name,
          },
        },
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .orderBy(orderBy)
      .limit(data.limit)
      .offset(offset)

    if (whereClause) {
      bookingsQuery.where(whereClause)
    }

    // Execute queries in parallel
    const [totalCountResult, bookingsList] = await Promise.all([
      countQuery,
      bookingsQuery
    ])

    const total = totalCountResult[0]?.count || 0
    const totalPages = Math.ceil(total / data.limit)

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
    const { booking, equipment, user, category } = await import('@/db/schema')
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
          imagePath: equipment.imagePath,
          googleCalendarId: equipment.googleCalendarId,
          category: {
            id: category.id,
            name: category.name,
          },
        },
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .leftJoin(category, eq(equipment.categoryId, category.id))
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
    const { deleteCalendarEvent, updateCalendarEvent, checkCalendarFreeBusy } = await import('@/lib/google/google-caledar')
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
    const newStartTime = data.startTime || bookingData.startTime.toISOString()
    const newEndTime = data.endTime || bookingData.endTime.toISOString()

    if ((data.startTime || data.endTime) && bookingData.equipment?.googleCalendarId) {
      const freeBusyResult = await checkCalendarFreeBusy({
        data: {
          calendarId: bookingData.equipment.googleCalendarId,
          timeMin: newStartTime,
          timeMax: newEndTime,
        }
      })

      if (freeBusyResult.busy.length > 0) {
        const err: any = new Error('Requested time conflicts with existing booking')
        err.conflict = freeBusyResult.busy[0]
        throw err
      }
    }

    // Update booking status and notes (admin notes will be appended to userEventDetails)
    const updatedNotes = data.notes
      ? `${bookingData.userEventDetails || ''}\n\n[Admin Note by ${adminUser.email}]: ${data.notes}`.trim()
      : bookingData.userEventDetails

    await database
      .update(booking)
      .set({
        status: data.status,
        userEventDetails: updatedNotes,
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
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
            start: { dateTime: newStartTime, timeZone: 'UTC' },
            end: { dateTime: newEndTime, timeZone: 'UTC' },
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

/**
 * Delete booking permanently with admin privileges
 * Also handles Google Calendar event deletion
 */
export const deleteBookingAdminFn = createServerFn({ method: 'POST' })
  .inputValidator(DeleteBookingSchema)
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { deleteCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Get the booking with equipment details for calendar deletion
    const bookingItem = await database
      .select({
        id: booking.id,
        equipmentId: booking.equipmentId,
        googleCalendarEventId: booking.googleCalendarEventId,
        equipment: {
          googleCalendarId: equipment.googleCalendarId,
        },
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const bookingData = bookingItem[0]

    if (!bookingData) {
      throw new Error('Booking not found')
    }

    // Delete calendar event if exists
    if (bookingData.googleCalendarEventId && bookingData.equipment?.googleCalendarId) {
      try {
        await deleteCalendarEvent({
          data: {
            equipmentCalendarId: bookingData.equipment.googleCalendarId,
            eventId: bookingData.googleCalendarEventId,
          }
        })
      } catch (calendarError) {
        console.error('Failed to delete calendar event during booking deletion:', calendarError)
      }
    }

    // Log booking deletion to Telegram channel before deleting record
    try {
      await logBookingActivityById(data.bookingId, 'deleted', {
        notes: 'Booking permanently deleted by administrator'
      })
    } catch (logError) {
      console.error('Failed to log booking deletion:', logError)
    }

    // Delete booking record from database
    await database
      .delete(booking)
      .where(eq(booking.id, data.bookingId))

    return { success: true }
  })
