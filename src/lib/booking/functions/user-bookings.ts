import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type {
  BookingWithEquipment,
  PaginatedBookingsResponse,
} from '../types'
import {
  BookingInputSchema,
  MultiBookingInputSchema,
  BookingFiltersSchema,
  CancelBookingSchema,
  UpdateBookingSchema,
  BulkUpdateBookingTimeSchema,
  GetBookingByIdSchema,
} from '../types'
import { buildEventDescription, formatUserDisplayName } from '@/lib/utils'

type UserIdentity = {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  telegramUsername?: string | null
}

function hasUserIdentity(identity?: UserIdentity | null): boolean {
  return !!(
    identity?.firstName ||
    identity?.lastName ||
    identity?.name ||
    identity?.telegramUsername
  )
}

async function resolveUserDisplayName(params: {
  database: any
  userId: string
  sessionUser?: UserIdentity | null
  userTable: any
  eq: any
}): Promise<string> {
  const { database, userId, sessionUser, userTable, eq } = params

  if (hasUserIdentity(sessionUser)) {
    return formatUserDisplayName(sessionUser || {})
  }

  const userRecord = await database
    .select({
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      name: userTable.name,
      telegramUsername: userTable.telegramUsername
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .get()

  return formatUserDisplayName(userRecord || {})
}


/**
 * Get Telegram bot username from environment
 */
export const getTelegramBotUsernameFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { env } = await import('cloudflare:workers')
    return env.TELEGRAM_BOT_USERNAME
  })

/**
 * bookingFlow: performs a full booking + calendar event creation in a single server function.
 * Uses the master account to create events in equipment-specific calendars with user as attendee.
 */
export const handleBookingAndCalendar = createServerFn({ method: 'POST' })
  .validator(BookingInputSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { createCalendarEvent, checkCalendarFreeBusy } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, user } = await import('@/db/schema')
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
        calendarId: equipmentCalendarId,
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
    const userDisplayName = await resolveUserDisplayName({
      database,
      userId,
      sessionUser: session.user,
      userTable: user,
      eq
    })

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

    // Get global booking note from settings
    const { settings } = await import('@/db/schema')
    const settingsData = await database
      .select({ globalBookingNote: settings.globalBookingNote })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get()

    const globalNote = settingsData?.globalBookingNote
    const description = buildEventDescription({
      bookingId,
      userDisplayName,
      notes,
      globalNote
    })

    const event = {
      summary: `${equipmentData?.modelName || `Equipment ${equipmentId}`} - Booking`,
      description,
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

export const handleMultiBookingAndCalendar = createServerFn({ method: 'POST' })
  .validator(MultiBookingInputSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { createCalendarEvent, checkMultipleCalendarsFreeBusy, deleteCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, settings, user } = await import('@/db/schema')
    const { eq, inArray } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { getEquipmentCalendarId, retry } = await import('../server')

    const { equipmentIds, startTime, endTime, notes } = data

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id
    const userEmail = session.user.email
    if (!userId) throw new Error('Unable to determine user id from session')
    if (!userEmail) throw new Error('Unable to determine user email from session')

    const equipmentCalendarIds = await Promise.all(
      equipmentIds.map(async (equipmentId) => ({
        equipmentId,
        calendarId: await getEquipmentCalendarId(equipmentId),
      }))
    )

    const missingCalendar = equipmentCalendarIds.find((item) => !item.calendarId)
    if (missingCalendar) {
      throw new Error(`No calendar configured for equipment ${missingCalendar.equipmentId}`)
    }

    const resolvedCalendars = equipmentCalendarIds.map((item) => ({
      equipmentId: item.equipmentId,
      calendarId: item.calendarId as string,
    }))

    const calendarIds = resolvedCalendars.map((item) => item.calendarId)

    const freeBusyResult = await checkMultipleCalendarsFreeBusy({
      data: {
        equipmentCalendarIds: calendarIds,
        timeMin: startTime,
        timeMax: endTime,
      }
    })

    const conflicts = resolvedCalendars
      .map(({ equipmentId, calendarId }) => {
        const busy = freeBusyResult[calendarId]?.busy || []
        return busy.length > 0 ? { equipmentId, conflict: busy[0] } : null
      })
      .filter((item): item is { equipmentId: number; conflict: { start: string; end: string } } => Boolean(item))

    if (conflicts.length > 0) {
      const err: any = new Error('Requested time conflicts with existing booking(s)')
      err.conflicts = conflicts
      throw err
    }

    const database = db(env.meriksirat_d1 as D1Database)
    const now = Date.now()
    const userDisplayName = await resolveUserDisplayName({
      database,
      userId,
      sessionUser: session.user,
      userTable: user,
      eq
    })

    const equipmentData = await database
      .select({ id: equipment.id, modelName: equipment.modelName })
      .from(equipment)
      .where(inArray(equipment.id, equipmentIds))

    const equipmentNameMap = new Map(equipmentData.map((item) => [item.id, item.modelName]))

    const settingsData = await database
      .select({ globalBookingNote: settings.globalBookingNote })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get()

    const globalNote = settingsData?.globalBookingNote

    const createdRecords: Array<{ bookingId: number; calendarId: string; eventId: string }> = []

    try {
      for (const { equipmentId, calendarId } of resolvedCalendars) {
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

        const description = buildEventDescription({
          bookingId,
          userDisplayName,
          notes,
          globalNote
        })

        const event = {
          summary: `${equipmentNameMap.get(equipmentId) || `Equipment ${equipmentId}`} - Booking`,
          description,
          start: { dateTime: startTime, timeZone: 'UTC' },
          end: { dateTime: endTime, timeZone: 'UTC' },
        }

        const createdEvent = await retry(() =>
          createCalendarEvent({
            data: {
              equipmentCalendarId: calendarId,
              event,
              userEmail,
            }
          }),
          3,
          400,
        )

        const gCalEventId = createdEvent?.eventId
        if (!gCalEventId) {
          throw new Error('Calendar API responded without event id')
        }

        await database.update(booking)
          .set({ googleCalendarEventId: gCalEventId, updatedAt: new Date() })
          .where(eq(booking.id, bookingId))

        createdRecords.push({ bookingId, calendarId, eventId: gCalEventId })

        try {
          await logBookingActivityById(bookingId, 'created', {
            newStatus: 'booked',
            notes
          })
        } catch (logError) {
          console.error('Failed to log booking creation:', logError)
        }
      }
    } catch (err) {
      for (const record of createdRecords) {
        try {
          await deleteCalendarEvent({
            data: {
              equipmentCalendarId: record.calendarId,
              eventId: record.eventId,
            }
          })
        } catch (deleteError) {
          console.error('Failed to delete calendar event during rollback:', deleteError)
        }

        try {
          await database.delete(booking).where(eq(booking.id, record.bookingId))
        } catch (dbDelErr) {
          console.error('Rollback delete failed for booking', record.bookingId, dbDelErr)
        }
      }
      throw err
    }

    return { bookingIds: createdRecords.map((record) => record.bookingId) }
  })

export const getUserBookingsFn = createServerFn({ method: 'GET' })
  .validator(BookingFiltersSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, category } = await import('@/db/schema')
    const { eq, and, sql, asc, desc, inArray } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      return null
    }

    const userId = session.user.id
    const database = db(env.meriksirat_d1 as D1Database)

    // Build where conditions
    const conditions = [eq(booking.userId, userId)]

    if (data.status && data.status.length > 0) {
      conditions.push(inArray(booking.status, data.status))
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

    const offset = (data.page - 1) * data.limit

    // Apply sorting
    const sortColumn = {
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      createdAt: booking.createdAt,
      equipment: equipment.modelName,
    }[data.sortBy]

    const orderBy = sortColumn ? (data.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)) : desc(booking.startTime)

    // Get total count for pagination - join not needed for count here
    const countQuery = database
      .select({ count: sql<number>`count(*)` })
      .from(booking)
      .where(whereClause)

    // Get paginated bookings list
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
        equipmentId_val: equipment.id,
        equipmentModelName: equipment.modelName,
        equipmentDescription: equipment.description,
        equipmentCategoryId: equipment.categoryId,
        equipmentImagePath: equipment.imagePath,
        equipmentGoogleCalendarId: equipment.googleCalendarId,
        categoryPathId: category.id,
        categoryName: category.name,
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(data.limit)
      .offset(offset)

    // Execute queries in parallel
    const [totalCountResult, bookingsList] = await Promise.all([
      countQuery,
      bookingsQuery
    ])

    const total = totalCountResult[0]?.count || 0
    const totalPages = Math.ceil(total / data.limit)

    const response: PaginatedBookingsResponse = {
      data: bookingsList.map(item => ({
        id: item.id,
        userId: item.userId,
        equipmentId: item.equipmentId,
        startTime: item.startTime,
        endTime: item.endTime,
        status: item.status,
        googleCalendarEventId: item.googleCalendarEventId,
        userEventDetails: item.userEventDetails,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        equipment: item.equipmentId_val ? {
          id: item.equipmentId_val,
          modelName: item.equipmentModelName!,
          description: item.equipmentDescription,
          categoryId: item.equipmentCategoryId,
          googleCalendarId: item.equipmentGoogleCalendarId!,
          imagePath: item.equipmentImagePath,
          category: item.categoryPathId ? {
            id: item.categoryPathId,
            name: item.categoryName!,
          } : null,
        } : null,
      })) as BookingWithEquipment[],
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
  .validator(GetBookingByIdSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, category } = await import('@/db/schema')
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
        equipmentId_val: equipment.id,
        equipmentModelName: equipment.modelName,
        equipmentDescription: equipment.description,
        equipmentCategoryId: equipment.categoryId,
        equipmentGoogleCalendarId: equipment.googleCalendarId,
        equipmentImagePath: equipment.imagePath,
        categoryPathId: category.id,
        categoryName: category.name,
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const rawResult = bookingItem[0]
    const result: BookingWithEquipment | undefined = rawResult ? {
      id: rawResult.id,
      userId: rawResult.userId,
      equipmentId: rawResult.equipmentId,
      startTime: rawResult.startTime,
      endTime: rawResult.endTime,
      status: rawResult.status,
      googleCalendarEventId: rawResult.googleCalendarEventId,
      userEventDetails: rawResult.userEventDetails,
      createdAt: rawResult.createdAt,
      updatedAt: rawResult.updatedAt,
      equipment: rawResult.equipmentId_val ? {
        id: rawResult.equipmentId_val,
        modelName: rawResult.equipmentModelName!,
        description: rawResult.equipmentDescription,
        categoryId: rawResult.equipmentCategoryId,
        googleCalendarId: rawResult.equipmentGoogleCalendarId!,
        imagePath: rawResult.equipmentImagePath,
        category: rawResult.categoryPathId ? {
          id: rawResult.categoryPathId,
          name: rawResult.categoryName!,
        } : null,
      } : null,
    } : undefined

    // Only return booking if it belongs to the current user
    if (result && result.userId !== userId) {
      return null
    }

    return result
  })

export const cancelBookingFn = createServerFn({ method: 'POST' })
  .validator(CancelBookingSchema)
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
  .validator(UpdateBookingSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { checkCalendarFreeBusy, updateCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, user } = await import('@/db/schema')
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
    const userDisplayName = await resolveUserDisplayName({
      database,
      userId,
      sessionUser: session.user,
      userTable: user,
      eq
    })

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
            calendarId: equipmentCalendarId,
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

        // Get global booking note from settings
        const { settings } = await import('@/db/schema')
        const settingsData = await database
          .select({ globalBookingNote: settings.globalBookingNote })
          .from(settings)
          .where(eq(settings.id, 'global'))
          .get()

        const globalNote = settingsData?.globalBookingNote
        const description = buildEventDescription({
          bookingId: data.bookingId,
          userDisplayName,
          notes: newNotes,
          globalNote
        })

        const event = {
          summary: `${equipmentData?.modelName || `Equipment ${bookingData.equipmentId}`} - Booking`,
          description,
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

export const updateBookingsTimeFn = createServerFn({ method: 'POST' })
  .validator(BulkUpdateBookingTimeSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { checkCalendarFreeBusy, updateCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, settings, user } = await import('@/db/schema')
    const { eq, inArray } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id
    const userEmail = session.user.email
    const database = db(env.meriksirat_d1 as D1Database)
    const userDisplayName = await resolveUserDisplayName({
      database,
      userId,
      sessionUser: session.user,
      userTable: user,
      eq
    })

    const bookingItems = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        googleCalendarEventId: booking.googleCalendarEventId,
        userEventDetails: booking.userEventDetails,
        equipmentCalendarId: equipment.googleCalendarId,
        equipmentModelName: equipment.modelName,
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .where(inArray(booking.id, data.bookingIds))

    if (bookingItems.length !== data.bookingIds.length) {
      throw new Error('Some bookings were not found')
    }

    const unauthorized = bookingItems.find((item) => item.userId !== userId)
    if (unauthorized) {
      throw new Error('Unauthorized')
    }

    const cancelled = bookingItems.find((item) => item.status === 'cancelled')
    if (cancelled) {
      throw new Error('Cannot update a cancelled booking')
    }

    const conflicts: Array<{ bookingId: number; conflict: { start: string; end: string } }> = []

    for (const bookingItem of bookingItems) {
      if (!bookingItem.equipmentCalendarId) continue
      const freeBusyResult = await checkCalendarFreeBusy({
        data: {
          calendarId: bookingItem.equipmentCalendarId,
          timeMin: data.startTime,
          timeMax: data.endTime,
        }
      })

      if (freeBusyResult.busy.length > 0) {
        conflicts.push({ bookingId: bookingItem.id, conflict: freeBusyResult.busy[0] })
      }
    }

    if (conflicts.length > 0) {
      const err: any = new Error('Requested time conflicts with existing booking(s)')
      err.conflicts = conflicts
      throw err
    }

    const settingsData = await database
      .select({ globalBookingNote: settings.globalBookingNote })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get()

    const globalNote = settingsData?.globalBookingNote

    for (const bookingItem of bookingItems) {
      await database
        .update(booking)
        .set({
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          updatedAt: new Date(),
        })
        .where(eq(booking.id, bookingItem.id))

      try {
        await logBookingActivityById(bookingItem.id, 'updated', {
          notes: bookingItem.userEventDetails || undefined,
          newStatus: bookingItem.status
        })
      } catch (logError) {
        console.error('Failed to log booking update:', logError)
      }

      if (bookingItem.googleCalendarEventId && bookingItem.equipmentCalendarId) {
        const description = buildEventDescription({
          bookingId: bookingItem.id,
          userDisplayName,
          notes: bookingItem.userEventDetails,
          globalNote
        })

        const event = {
          summary: `${bookingItem.equipmentModelName || `Equipment ${bookingItem.equipmentId}`} - Booking`,
          description,
          start: { dateTime: data.startTime, timeZone: 'UTC' },
          end: { dateTime: data.endTime, timeZone: 'UTC' },
        }

        await updateCalendarEvent({
          data: {
            equipmentCalendarId: bookingItem.equipmentCalendarId,
            eventId: bookingItem.googleCalendarEventId,
            event,
            userEmail,
          }
        })
      }
    }

    return { success: true, bookingIds: data.bookingIds }
  })
