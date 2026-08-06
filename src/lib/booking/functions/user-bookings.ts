import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type {
  BookingWithItems,
  PaginatedBookingsResponse,
} from '../types'
import {
  CreateBookingSchema,
  BookingFiltersSchema,
  CancelBookingSchema,
  UpdateBookingSchema,
  BulkUpdateBookingTimeSchema,
  GetBookingByIdSchema,
} from '../types'
import type { BookingItemRow } from '../mappers'
import { mapBookingsWithItems, itemSelect } from '../mappers'
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
 * createBookingFn: creates a single booking (parent) containing one or more
 * booking items (one per piece of equipment). Each item gets its own Google
 * Calendar event in the equipment's dedicated calendar.
 */
export const createBookingFn = createServerFn({ method: 'POST' })
  .validator(CreateBookingSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { createCalendarEvent, checkMultipleCalendarsFreeBusy, deleteCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment, settings, user } = await import('@/db/schema')
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

    // Create the parent booking first
    const insertResult = await database.insert(booking).values({
      userId,
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

    const createdItems: Array<{ bookingItemId: number; calendarId: string; eventId: string }> = []

    try {
      for (const { equipmentId, calendarId } of resolvedCalendars) {
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

        const itemInsert = await database.insert(bookingItem).values({
          bookingId,
          equipmentId,
          status: 'booked',
          googleCalendarEventId: gCalEventId,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        }).returning({ id: bookingItem.id })

        const bookingItemId = itemInsert[0]?.id
        if (!bookingItemId) {
          throw new Error('Failed to create booking item record')
        }

        createdItems.push({ bookingItemId, calendarId, eventId: gCalEventId })
      }
    } catch (err) {
      // Rollback: delete created events, items and the parent booking
      for (const record of createdItems) {
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
          await database.delete(bookingItem).where(eq(bookingItem.id, record.bookingItemId))
        } catch (dbDelErr) {
          console.error('Rollback delete failed for booking item', record.bookingItemId, dbDelErr)
        }
      }

      try {
        await database.delete(booking).where(eq(booking.id, bookingId))
      } catch (dbDelErr) {
        console.error('Rollback delete failed for booking', bookingId, dbDelErr)
      }

      throw err
    }

    // Log booking creation to Telegram channel
    try {
      await logBookingActivityById(bookingId, 'created', {
        newStatus: 'booked',
        notes
      })
    } catch (logError) {
      console.error('Failed to log booking creation:', logError)
    }

    return { bookingId }
  })

/**
 * getUserBookingsFn: paginated list of the current user's bookings with items.
 */
export const getUserBookingsFn = createServerFn({ method: 'GET' })
  .validator(BookingFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedBookingsResponse | null> => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment, category } = await import('@/db/schema')
    const { eq, and, gte, lte, sql, asc, desc, inArray } = await import('drizzle-orm')

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
      conditions.push(eq(bookingItem.equipmentId, data.equipmentId))
    }

    if (data.startDate) {
      conditions.push(gte(booking.startTime, new Date(data.startDate)))
    }

    if (data.endDate) {
      conditions.push(lte(booking.endTime, new Date(data.endDate)))
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)

    const offset = (data.page - 1) * data.limit

    const order = (() => {
      const dir = data.sortOrder === 'desc' ? desc : asc
      switch (data.sortBy) {
        case 'startTime': return dir(booking.startTime)
        case 'endTime': return dir(booking.endTime)
        case 'status': return dir(booking.status)
        case 'createdAt': return dir(booking.createdAt)
        case 'equipment': return dir(sql`min(${equipment.modelName})`)
        default: return dir(booking.startTime)
      }
    })()

    const countQuery = database
      .select({ count: sql<number>`count(distinct ${booking.id})` })
      .from(booking)
      .leftJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
      .where(whereClause)

    // Get paginated parent bookings
    const bookingsQuery = database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        userEventDetails: booking.userEventDetails,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        sortEquipmentName: sql<string | null>`min(${equipment.modelName})`,
      })
      .from(booking)
      .leftJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(whereClause)
      .groupBy(booking.id)
      .orderBy(order)
      .limit(data.limit)
      .offset(offset)

    const [totalCountResult, pageBookings] = await Promise.all([
      countQuery,
      bookingsQuery
    ])

    const total = totalCountResult[0]?.count || 0
    const totalPages = Math.ceil(total / data.limit)

    const pageBookingIds = pageBookings.map((b) => b.id)

    // Fetch full item rows for the current page
    let flatRows: BookingItemRow[] = []
    if (pageBookingIds.length > 0) {
      const itemRows = await database
        .select({ bookingId: bookingItem.bookingId, ...itemSelect(bookingItem, equipment, category) })
        .from(bookingItem)
        .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
        .leftJoin(category, eq(equipment.categoryId, category.id))
        .where(inArray(bookingItem.bookingId, pageBookingIds))
        .orderBy(bookingItem.id)

      const itemsByBooking = new Map<number, (typeof itemRows)[number][]>()
      for (const row of itemRows) {
        const list = itemsByBooking.get(row.bookingId) ?? []
        list.push(row)
        itemsByBooking.set(row.bookingId, list)
      }

      flatRows = pageBookings.flatMap((b) => {
        const items = itemsByBooking.get(b.id) ?? []
        if (items.length === 0) {
          return [{
            bookingId: b.id,
            userId: b.userId,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
            userEventDetails: b.userEventDetails,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
            itemId: 0,
            equipmentId: 0,
            itemStatus: 'cancelled',
            gcalEventId: null,
            returnedAt: null,
            itemCreatedAt: b.createdAt,
            itemUpdatedAt: b.updatedAt,
            eqId: null,
            eqModelName: null,
            eqDescription: null,
            eqCategoryId: null,
            eqImagePath: null,
            eqGcalId: null,
            catId: null,
            catName: null,
          } as BookingItemRow]
        }
        return items.map((it) => ({
          bookingId: b.id,
          userId: b.userId,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          userEventDetails: b.userEventDetails,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          itemId: it.itemId,
          equipmentId: it.equipmentId,
          itemStatus: it.itemStatus,
          gcalEventId: it.gcalEventId,
          returnedAt: it.returnedAt,
          itemCreatedAt: it.itemCreatedAt,
          itemUpdatedAt: it.itemUpdatedAt,
          eqId: it.eqId,
          eqModelName: it.eqModelName,
          eqDescription: it.eqDescription,
          eqCategoryId: it.eqCategoryId,
          eqImagePath: it.eqImagePath,
          eqGcalId: it.eqGcalId,
          catId: it.catId,
          catName: it.catName,
        }))
      })
    }

    const dataWithItems = mapBookingsWithItems(flatRows)

    const response: PaginatedBookingsResponse = {
      data: dataWithItems as BookingWithItems[],
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
  .handler(async ({ data }): Promise<BookingWithItems | null> => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment, category } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      return null
    }

    const userId = session.user.id
    const database = db(env.meriksirat_d1 as D1Database)

    const bookingData = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        userEventDetails: booking.userEventDetails,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const parent = bookingData[0]

    // Only return booking if it belongs to the current user
    if (!parent) return null
    if (parent.userId !== userId) return null

    const itemRows = await database
      .select({ bookingId: bookingItem.bookingId, ...itemSelect(bookingItem, equipment, category) })
      .from(bookingItem)
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(eq(bookingItem.bookingId, parent.id))
      .orderBy(bookingItem.id)

    const flatRows: BookingItemRow[] = itemRows.map((it) => ({
      bookingId: parent.id,
      userId: parent.userId,
      startTime: parent.startTime,
      endTime: parent.endTime,
      status: parent.status,
      userEventDetails: parent.userEventDetails,
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
      itemId: it.itemId,
      equipmentId: it.equipmentId,
      itemStatus: it.itemStatus,
      gcalEventId: it.gcalEventId,
      returnedAt: it.returnedAt,
      itemCreatedAt: it.itemCreatedAt,
      itemUpdatedAt: it.itemUpdatedAt,
      eqId: it.eqId,
      eqModelName: it.eqModelName,
      eqDescription: it.eqDescription,
      eqCategoryId: it.eqCategoryId,
      eqImagePath: it.eqImagePath,
      eqGcalId: it.eqGcalId,
      catId: it.catId,
      catName: it.catName,
    }))

    return mapBookingsWithItems(flatRows)[0] ?? null
  })

export const cancelBookingFn = createServerFn({ method: 'POST' })
  .validator(CancelBookingSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { deleteCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { recomputeBookingStatus } = await import('../status')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id
    const database = db(env.meriksirat_d1 as D1Database)

    // Get the booking to verify ownership
    const bookingItemData = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        status: booking.status,
      })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const bookingData = bookingItemData[0]

    if (!bookingData) {
      throw new Error('Booking not found')
    }

    if (bookingData.userId !== userId) {
      throw new Error('Unauthorized')
    }

    if (bookingData.status === 'cancelled') {
      throw new Error('Booking is already cancelled')
    }

    // Load items with equipment calendars for event cleanup
    const items = await database
      .select({
        id: bookingItem.id,
        googleCalendarEventId: bookingItem.googleCalendarEventId,
        equipmentCalendarId: equipment.googleCalendarId,
      })
      .from(bookingItem)
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .where(eq(bookingItem.bookingId, data.bookingId))

    // Mark all items as cancelled
    await database
      .update(bookingItem)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookingItem.bookingId, data.bookingId))

    // Recompute and persist parent status
    await recomputeBookingStatus(database, data.bookingId)

    // Log booking cancellation to Telegram channel
    try {
      await logBookingActivityById(data.bookingId, 'cancelled', {
        previousStatus: bookingData.status,
        newStatus: 'cancelled'
      })
    } catch (logError) {
      console.error('Failed to log booking cancellation:', logError)
    }

    // Delete the calendar events for all items
    for (const item of items) {
      if (item.googleCalendarEventId && item.equipmentCalendarId) {
        try {
          await deleteCalendarEvent({
            data: {
              equipmentCalendarId: item.equipmentCalendarId,
              eventId: item.googleCalendarEventId,
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
    const { booking, bookingItem, equipment, user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
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

    // Get the booking to verify ownership
    const bookingItemData = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userEventDetails: booking.userEventDetails,
        status: booking.status,
      })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const bookingData = bookingItemData[0]

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

    // Load items with equipment calendars
    const items = await database
      .select({
        id: bookingItem.id,
        googleCalendarEventId: bookingItem.googleCalendarEventId,
        equipmentCalendarId: equipment.googleCalendarId,
        equipmentId: equipment.id,
        equipmentModelName: equipment.modelName,
      })
      .from(bookingItem)
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .where(eq(bookingItem.bookingId, data.bookingId))

    // If times are changing, check availability on all item calendars
    if (data.startTime || data.endTime) {
      for (const item of items) {
        if (!item.equipmentCalendarId) continue
        const freeBusyResult = await checkCalendarFreeBusy({
          data: {
            calendarId: item.equipmentCalendarId,
            timeMin: newStartTime,
            timeMax: newEndTime,
          }
        })

        if (freeBusyResult.busy.length > 0) {
          const err: any = new Error(`Requested time conflicts with existing booking for ${item.equipmentModelName || `equipment ${item.equipmentId}`}`)
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

    // Update calendar events for each item
    const { settings } = await import('@/db/schema')
    const settingsData = await database
      .select({ globalBookingNote: settings.globalBookingNote })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get()

    const globalNote = settingsData?.globalBookingNote

    for (const item of items) {
      if (!item.googleCalendarEventId || !item.equipmentCalendarId) continue

      const description = buildEventDescription({
        bookingId: data.bookingId,
        userDisplayName,
        notes: newNotes,
        globalNote
      })

      const event = {
        summary: `${item.equipmentModelName || `Equipment ${item.equipmentId}`} - Booking`,
        description,
        start: { dateTime: newStartTime, timeZone: 'UTC' },
        end: { dateTime: newEndTime, timeZone: 'UTC' },
      }

      try {
        await updateCalendarEvent({
          data: {
            equipmentCalendarId: item.equipmentCalendarId,
            eventId: item.googleCalendarEventId,
            event,
            userEmail,
          }
        })
      } catch (err) {
        console.error('Failed to update calendar event:', err)
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
    const { booking, bookingItem, equipment, settings, user } = await import('@/db/schema')
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

    const bookings = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        userEventDetails: booking.userEventDetails,
      })
      .from(booking)
      .where(inArray(booking.id, data.bookingIds))

    if (bookings.length !== data.bookingIds.length) {
      throw new Error('Some bookings were not found')
    }

    const unauthorized = bookings.find((item) => item.userId !== userId)
    if (unauthorized) {
      throw new Error('Unauthorized')
    }

    const cancelled = bookings.find((item) => item.status === 'cancelled')
    if (cancelled) {
      throw new Error('Cannot update a cancelled booking')
    }

    const items = await database
      .select({
        bookingId: bookingItem.bookingId,
        id: bookingItem.id,
        googleCalendarEventId: bookingItem.googleCalendarEventId,
        equipmentCalendarId: equipment.googleCalendarId,
        equipmentId: equipment.id,
        equipmentModelName: equipment.modelName,
      })
      .from(bookingItem)
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .where(inArray(bookingItem.bookingId, data.bookingIds))

    const itemsByBooking = new Map<number, (typeof items)[number][]>()
    for (const item of items) {
      const list = itemsByBooking.get(item.bookingId) ?? []
      list.push(item)
      itemsByBooking.set(item.bookingId, list)
    }

    const conflicts: Array<{ bookingId: number; conflict: { start: string; end: string } }> = []

    for (const item of items) {
      if (!item.equipmentCalendarId) continue
      const freeBusyResult = await checkCalendarFreeBusy({
        data: {
          calendarId: item.equipmentCalendarId,
          timeMin: data.startTime,
          timeMax: data.endTime,
        }
      })

      if (freeBusyResult.busy.length > 0) {
        conflicts.push({ bookingId: item.bookingId, conflict: freeBusyResult.busy[0] })
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

    for (const bookingItemRecord of bookings) {
      await database
        .update(booking)
        .set({
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          updatedAt: new Date(),
        })
        .where(eq(booking.id, bookingItemRecord.id))

      try {
        await logBookingActivityById(bookingItemRecord.id, 'updated', {
          notes: bookingItemRecord.userEventDetails || undefined,
          newStatus: bookingItemRecord.status
        })
      } catch (logError) {
        console.error('Failed to log booking update:', logError)
      }

      const bookingItems = itemsByBooking.get(bookingItemRecord.id) ?? []
      for (const item of bookingItems) {
        if (!item.googleCalendarEventId || !item.equipmentCalendarId) continue

        const description = buildEventDescription({
          bookingId: bookingItemRecord.id,
          userDisplayName,
          notes: bookingItemRecord.userEventDetails,
          globalNote
        })

        const event = {
          summary: `${item.equipmentModelName || `Equipment ${item.equipmentId}`} - Booking`,
          description,
          start: { dateTime: data.startTime, timeZone: 'UTC' },
          end: { dateTime: data.endTime, timeZone: 'UTC' },
        }

        await updateCalendarEvent({
          data: {
            equipmentCalendarId: item.equipmentCalendarId,
            eventId: item.googleCalendarEventId,
            event,
            userEmail,
          }
        })
      }
    }

    return { success: true, bookingIds: data.bookingIds }
  })
