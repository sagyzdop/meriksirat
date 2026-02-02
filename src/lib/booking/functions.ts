import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { 
  BookingWithEquipment, 
  PaginatedBookingsResponse,
  PaginatedAdminBookingsResponse,
  AdminBookingWithDetails
} from './types'
import {
  BookingInputSchema,
  BookingFiltersSchema,
  CancelBookingSchema,
  UpdateBookingSchema,
  GetBookingByIdSchema,
  AdminBookingFiltersSchema,
  UpdateBookingStatusAdminSchema
} from './types'

/**
 * bookingFlow: performs a full booking + calendar event creation in a single server function.
 * Uses the master account to create events in equipment-specific calendars with user as attendee.
 */
export const handleBookingAndCalendar = createServerFn({ method: 'POST' })
  .inputValidator(BookingInputSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { auth } = await import('@/lib/auth')
    const { createCalendarEvent, checkCalendarFreeBusy } = await import('@/lib/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { getEquipmentCalendarId, retry } = await import('./server')
    
    const { equipmentId, startTime, endTime, notes } = data

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id
    const userEmail = session.user.email
    if (!userId) throw new Error('Unable to determine user id from session')
    if (!userEmail) throw new Error('Unable to determine user email from session')

    const equipmentCalendarId = await getEquipmentCalendarId(equipmentId)
    if (!equipmentCalendarId) throw new Error('No calendar configured for equipment')

    // Check if the time slot is available
    const freeBusyResult = await checkCalendarFreeBusy({
      data: {
        equipmentCalendarId,
        timeMin: startTime,
        timeMax: endTime,
      }
    })

    if (freeBusyResult.busy.length > 0) {
      const conflict = freeBusyResult.busy[0]
      const err: any = new Error('Requested time conflicts with existing booking')
      err.conflict = conflict
      throw err
    }

    const now = Date.now()
    const database = db(env.meriksirat_d1 as D1Database)

    // Insert booking record
    const insertResult = await database.insert(booking).values({
      userId,
      equipmentId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: 'booked',
      userEventDetails: notes || null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    }).returning({ id: booking.id })

    const bookingId = insertResult[0]?.id
    if (!bookingId) {
      throw new Error('Failed to create booking record')
    }

    // Get equipment details for the event
    const equipmentData = await database
      .select({ modelName: equipment.modelName })
      .from(equipment)
      .where(eq(equipment.id, equipmentId))
      .get()

    const event = {
      summary: `${equipmentData?.modelName || `Equipment ${equipmentId}`} - Booking`,
      description: `Booking ID: ${bookingId}\nUser: ${userEmail}\nNotes: ${notes || 'No additional notes'}`,
      start: { dateTime: startTime, timeZone: 'UTC' },
      end: { dateTime: endTime, timeZone: 'UTC' },
    }

    let createdEvent: any = null
    try {
      createdEvent = await retry(() =>
        createCalendarEvent({
          data: {
            equipmentCalendarId,
            event,
            userEmail,
          }
        }),
        3,
        400,
      )
    } catch (err) {
      // Rollback the booking if calendar event creation fails
      try {
        await database.delete(booking).where(eq(booking.id, bookingId))
      } catch (dbDelErr) {
        console.error('Rollback delete failed for booking', bookingId, dbDelErr)
      }
      throw new Error(`Failed creating calendar event: ${(err as any)?.message ?? String(err)}`)
    }

    const gCalEventId = createdEvent?.eventId
    if (!gCalEventId) {
      await database.delete(booking).where(eq(booking.id, bookingId))
      throw new Error('Calendar API responded without event id')
    }

    // Update booking with calendar event ID
    await database.update(booking)
      .set({ googleCalendarEventId: gCalEventId, updatedAt: new Date() }) 
      .where(eq(booking.id, bookingId))

    // Log booking creation to Telegram channel
    try {
      await logBookingActivityById(bookingId, 'created', {
        newStatus: 'booked',
        notes
      })
    } catch (logError) {
      console.error('Failed to log booking creation:', logError)
      // Don't fail the booking creation if logging fails
    }

    return { bookingId, gCalEventId }
  })

export const getUserBookingsFn = createServerFn({ method: 'GET' })
  .inputValidator(BookingFiltersSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { auth } = await import('@/lib/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment } = await import('@/db/schema')
    const { eq, and, sql } = await import('drizzle-orm')
    
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      return null
    }

    const userId = session.user.id
    const database = db(env.meriksirat_d1 as D1Database)

    // Build where conditions
    const conditions = [eq(booking.userId, userId)]

    if (data.status) {
      conditions.push(eq(booking.status, data.status))
    }

    if (data.equipmentId) {
      conditions.push(eq(booking.equipmentId, data.equipmentId))
    }

    if (data.startDate) {
      conditions.push(eq(booking.startTime, new Date(data.startDate)))
    }

    if (data.endDate) {
      conditions.push(eq(booking.endTime, new Date(data.endDate)))
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)

    // Get total count for pagination
    const totalCountResult = await database
      .select({ count: sql<number>`count(*)` })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .where(whereClause)

    const total = totalCountResult[0]?.count || 0
    const totalPages = Math.ceil(total / data.limit)
    const offset = (data.page - 1) * data.limit

    // Get paginated bookings list
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
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .where(whereClause)
      .orderBy(booking.startTime)
      .limit(data.limit)
      .offset(offset)

    const response: PaginatedBookingsResponse = {
      data: bookingsList as BookingWithEquipment[],
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

export const getBookingByIdFn = createServerFn({ method: 'GET' })
  .inputValidator(GetBookingByIdSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { auth } = await import('@/lib/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      return null
    }

    const userId = session.user.id
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
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const result = bookingItem[0] as BookingWithEquipment | undefined

    // Only return booking if it belongs to the current user
    if (result && result.userId !== userId) {
      return null
    }

    return result
  })

export const cancelBookingFn = createServerFn({ method: 'POST' })
  .inputValidator(CancelBookingSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { auth } = await import('@/lib/auth')
    const { deleteCalendarEvent } = await import('@/lib/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { getEquipmentCalendarId } = await import('./server')
    
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id
    const database = db(env.meriksirat_d1 as D1Database)

    // Get the booking to verify ownership and get calendar event ID
    const bookingItem = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        googleCalendarEventId: booking.googleCalendarEventId,
        status: booking.status,
      })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const bookingData = bookingItem[0]

    if (!bookingData) {
      throw new Error('Booking not found')
    }

    if (bookingData.userId !== userId) {
      throw new Error('Unauthorized')
    }

    if (bookingData.status === 'cancelled') {
      throw new Error('Booking is already cancelled')
    }

    // Update booking status to cancelled
    await database
      .update(booking)
      .set({ 
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(booking.id, data.bookingId))

    // Log booking cancellation to Telegram channel
    try {
      await logBookingActivityById(data.bookingId, 'cancelled', {
        previousStatus: bookingData.status,
        newStatus: 'cancelled'
      })
    } catch (logError) {
      console.error('Failed to log booking cancellation:', logError)
      // Don't fail the cancellation if logging fails
    }

    // Delete the calendar event if it exists
    if (bookingData.googleCalendarEventId) {
      const equipmentCalendarId = await getEquipmentCalendarId(bookingData.equipmentId)
      
      if (equipmentCalendarId) {
        try {
          await deleteCalendarEvent({
            data: {
              equipmentCalendarId,
              eventId: bookingData.googleCalendarEventId,
            }
          })
        } catch (err) {
          console.error('Failed to delete calendar event:', err)
          // Don't throw - booking is already cancelled in DB
        }
      }
    }

    return { success: true }
  })

export const updateBookingFn = createServerFn({ method: 'POST' })
  .inputValidator(UpdateBookingSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { auth } = await import('@/lib/auth')
    const { checkCalendarFreeBusy, updateCalendarEvent } = await import('@/lib/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { getEquipmentCalendarId } = await import('./server')
    
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id
    const userEmail = session.user.email
    const database = db(env.meriksirat_d1 as D1Database)

    // Get the booking to verify ownership
    const bookingItem = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        googleCalendarEventId: booking.googleCalendarEventId,
        userEventDetails: booking.userEventDetails,
        status: booking.status,
      })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const bookingData = bookingItem[0]

    if (!bookingData) {
      throw new Error('Booking not found')
    }

    if (bookingData.userId !== userId) {
      throw new Error('Unauthorized')
    }

    if (bookingData.status === 'cancelled') {
      throw new Error('Cannot update a cancelled booking')
    }

    const newStartTime = data.startTime || bookingData.startTime.toISOString()
    const newEndTime = data.endTime || bookingData.endTime.toISOString()
    const newNotes = data.notes !== undefined ? data.notes : (bookingData.userEventDetails || undefined)

    // If times are changing, check availability
    if (data.startTime || data.endTime) {
      const equipmentCalendarId = await getEquipmentCalendarId(bookingData.equipmentId)
      
      if (equipmentCalendarId) {
        const freeBusyResult = await checkCalendarFreeBusy({
          data: {
            equipmentCalendarId,
            timeMin: newStartTime,
            timeMax: newEndTime,
          }
        })

        // Check if there are any conflicts (excluding current booking's event)
        if (freeBusyResult.busy.length > 0) {
          const err: any = new Error('Requested time conflicts with existing booking')
          err.conflict = freeBusyResult.busy[0]
          throw err
        }
      }
    }

    // Update booking in database
    await database
      .update(booking)
      .set({
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
        userEventDetails: newNotes,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, data.bookingId))

    // Log booking update to Telegram channel
    try {
      await logBookingActivityById(data.bookingId, 'updated', {
        notes: newNotes,
        newStatus: bookingData.status
      })
    } catch (logError) {
      console.error('Failed to log booking update:', logError)
      // Don't fail the update if logging fails
    }

    // Update calendar event if it exists
    if (bookingData.googleCalendarEventId) {
      const equipmentCalendarId = await getEquipmentCalendarId(bookingData.equipmentId)
      
      if (equipmentCalendarId) {
        const equipmentData = await database
          .select({ modelName: equipment.modelName })
          .from(equipment)
          .where(eq(equipment.id, bookingData.equipmentId))
          .get()

        const event = {
          summary: `${equipmentData?.modelName || `Equipment ${bookingData.equipmentId}`} - Booking`,
          description: `Booking ID: ${data.bookingId}\nUser: ${userEmail}\nNotes: ${newNotes || 'No additional notes'}`,
          start: { dateTime: newStartTime, timeZone: 'UTC' },
          end: { dateTime: newEndTime, timeZone: 'UTC' },
        }

        try {
          await updateCalendarEvent({
            data: {
              equipmentCalendarId,
              eventId: bookingData.googleCalendarEventId,
              event,
              userEmail,
            }
          })
        } catch (err) {
          console.error('Failed to update calendar event:', err)
          // Don't throw - booking is already updated in DB
        }
      }
    }

    return { success: true }
  })

/**
 * Get all bookings with comprehensive filtering and pagination for admin oversight
 * Includes user and equipment details for administrative management
 */
export const getAdminBookingsFn = createServerFn({ method: 'GET' })
  .inputValidator(AdminBookingFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedAdminBookingsResponse> => {
    // Import server-only code inside handler
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
 * Update booking status with admin privileges and Google Calendar integration
 * Includes administrative notes capability and calendar synchronization
 */
export const updateBookingStatusAdminFn = createServerFn({ method: 'POST' })
  .inputValidator(UpdateBookingStatusAdminSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { deleteCalendarEvent, updateCalendarEvent } = await import('@/lib/google-caledar')
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
      // Don't fail the update if logging fails
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
          const event = {
            summary: `${bookingData.equipment.modelName || `Equipment ${bookingData.equipmentId}`} - Booking (${data.status.toUpperCase()})`,
            description: `Booking ID: ${data.bookingId}\nUser: ${bookingData.user?.email}\nStatus: ${data.status}\nNotes: ${updatedNotes || 'No notes'}`,
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
        // Don't throw - booking status is already updated in DB
      }
    }

    return { success: true, previousStatus, newStatus: data.status }
  })

/**
 * Detect and manage overdue bookings
 * Automatically updates booking status to 'overdue' for bookings past their end time
 */
export const detectOverdueBookingsFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { updateCalendarEvent } = await import('@/lib/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, user } = await import('@/db/schema')
    const { eq, and, or, lt } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    
    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)
    const now = new Date()

    // Find bookings that are past their end time but not yet marked as overdue
    const overdueBookings = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        endTime: booking.endTime,
        status: booking.status,
        googleCalendarEventId: booking.googleCalendarEventId,
        userEventDetails: booking.userEventDetails,
        equipment: {
          modelName: equipment.modelName,
          googleCalendarId: equipment.googleCalendarId,
        },
        user: {
          email: user.email,
        },
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(
        and(
          lt(booking.endTime, now),
          or(
            eq(booking.status, 'booked'),
            eq(booking.status, 'active')
          )
        )
      )

    const updatedBookingIds: number[] = []

    // Update each overdue booking
    for (const overdueBooking of overdueBookings) {
      try {
        // Update booking status to overdue and add admin note
        const overdueNote = `[System]: Automatically marked as overdue on ${now.toISOString()}`
        const updatedNotes = overdueBooking.userEventDetails 
          ? `${overdueBooking.userEventDetails}\n\n${overdueNote}`
          : overdueNote

        await database
          .update(booking)
          .set({
            status: 'overdue',
            userEventDetails: updatedNotes,
            updatedAt: now,
          })
          .where(eq(booking.id, overdueBooking.id))

        updatedBookingIds.push(overdueBooking.id)

        // Update calendar event if it exists
        if (overdueBooking.googleCalendarEventId && overdueBooking.equipment?.googleCalendarId) {
          const event = {
            summary: `${overdueBooking.equipment.modelName || `Equipment ${overdueBooking.equipmentId}`} - Booking (OVERDUE)`,
            description: `Booking ID: ${overdueBooking.id}\nUser: ${overdueBooking.user?.email}\nStatus: OVERDUE\nOriginal End Time: ${overdueBooking.endTime.toISOString()}\nMarked overdue: ${now.toISOString()}\nNotes: ${updatedNotes}`,
            start: { dateTime: overdueBooking.endTime.toISOString(), timeZone: 'UTC' },
            end: { dateTime: new Date(overdueBooking.endTime.getTime() + 24 * 60 * 60 * 1000).toISOString(), timeZone: 'UTC' }, // Extend by 1 day
          }

          await updateCalendarEvent({
            data: {
              equipmentCalendarId: overdueBooking.equipment.googleCalendarId,
              eventId: overdueBooking.googleCalendarEventId,
              event,
              userEmail: overdueBooking.user?.email || '',
            }
          })
        }

        // Log overdue booking detection
        try {
          await logBookingActivityById(overdueBooking.id, 'updated', {
            previousStatus: overdueBooking.status,
            newStatus: 'overdue',
            notes: 'Automatically marked as overdue by system'
          })
        } catch (logError) {
          console.error('Failed to log overdue booking detection:', logError)
        }
      } catch (error) {
        console.error(`Failed to update overdue booking ${overdueBooking.id}:`, error)
      }
    }

    return {
      success: true,
      overdueBookingsFound: overdueBookings.length,
      updatedBookingIds,
    }
  })

/**
 * Get booking details by ID for admin oversight
 * Includes user and equipment details for administrative management
 */
export const getAdminBookingByIdFn = createServerFn({ method: 'GET' })
  .inputValidator(GetBookingByIdSchema)
  .handler(async ({ data }): Promise<AdminBookingWithDetails | null> => {
    // Import server-only code inside handler
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
