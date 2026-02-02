import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { 
  BookingWithEquipment, 
  PaginatedBookingsResponse,
} from '../types'
import {
  BookingInputSchema,
  BookingFiltersSchema,
  CancelBookingSchema,
  UpdateBookingSchema,
  GetBookingByIdSchema,
} from '../types'

/**
 * bookingFlow: performs a full booking + calendar event creation in a single server function.
 * Uses the master account to create events in equipment-specific calendars with user as attendee.
 */
export const handleBookingAndCalendar = createServerFn({ method: 'POST' })
  .inputValidator(BookingInputSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { createCalendarEvent, checkCalendarFreeBusy } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { getEquipmentCalendarId, retry } = await import('../server')
    
    const { equipmentId, startTime, endTime, notes } = data

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

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
    }

    return { bookingId, gCalEventId }
  })

export const getUserBookingsFn = createServerFn({ method: 'GET' })
  .inputValidator(BookingFiltersSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment } = await import('@/db/schema')
    const { eq, and, sql } = await import('drizzle-orm')
    
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

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
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

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
    const { auth } = await import('@/lib/auth/auth')
    const { deleteCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { getEquipmentCalendarId } = await import('../server')
    
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

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
        }
      }
    }

    return { success: true }
  })

export const updateBookingFn = createServerFn({ method: 'POST' })
  .inputValidator(UpdateBookingSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { checkCalendarFreeBusy, updateCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { getEquipmentCalendarId } = await import('../server')
    
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

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
        }
      }
    }

    return { success: true }
  })
