import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { BookingWithItems, PaginatedBookingsResponse } from '../types'
import {
  CreateBookingSchema,
  BookingFiltersSchema,
  CancelBookingSchema,
  UpdateBookingSchema,
  GetBookingByIdSchema,
} from '../types'
import { formatUserDisplayName } from '@/lib/utils'
import { formatBookingDetailsPlain } from '../details'
import {
  MIN_BOOKING_ADVANCE_MS,
  MAX_BOOKING_DURATION_MS,
  MAX_BOOKING_HORIZON_MS,
} from '../operating-hours'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type * as schema from '@/db/schema'
import { buildPageInfo } from '@/lib/pagination'

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
  database: DrizzleD1Database<typeof schema>
  userId: string
  sessionUser?: UserIdentity | null
  userTable: typeof schema.user
  eq: typeof import('drizzle-orm').eq
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
      telegramUsername: userTable.telegramUsername,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .get()

  return formatUserDisplayName(userRecord || {})
}

/**
 * Get Telegram bot username from environment
 */
export const getTelegramBotUsernameFn = createServerFn({
  method: 'GET',
}).handler(async () => {
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
    const { userContext } = await import('@/lib/auth/context')
    const { booking, user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { loadBookableEquipment, assertNoConflicts, createItemsWithEvents } =
      await import('../create-items')

    const { equipmentIds, startTime, endTime, notes } = data

    // Dedupe equipment ids from the schema so the same item cannot be booked
    // twice in one request.
    const dedupedEquipmentIds = [...new Set(equipmentIds)]

    const startMs = new Date(startTime).getTime()
    const endMs = new Date(endTime).getTime()

    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs
    ) {
      throw new Error('Invalid booking times')
    }

    if (startMs < Date.now() + MIN_BOOKING_ADVANCE_MS) {
      throw new Error(
        'Bookings must start at least 1 hour from now. Please select a later time slot.'
      )
    }

    if (endMs - startMs > MAX_BOOKING_DURATION_MS) {
      throw new Error('Bookings cannot be longer than 48 hours.')
    }

    if (startMs > Date.now() + MAX_BOOKING_HORIZON_MS) {
      throw new Error('Bookings must start within 60 days.')
    }

    const { session, database, headers } =
      await userContext('Not authenticated')

    const { assertAccess } = await import('@/lib/access/server')
    await assertAccess(
      database,
      session.user.id,
      'canBook',
      'Only club members can book equipment'
    )

    // Per-user rate limit so a single member cannot spam booking creation
    // (each attempt runs free/busy queries + calendar event inserts).
    const { rateLimit } = await import('@/lib/ratelimit')
    const bookingRateLimit = await rateLimit(
      headers,
      'rl_create_booking',
      session.user.id
    )
    if (!bookingRateLimit.allowed) {
      throw new Error('Too many booking requests. Please try again shortly.')
    }

    const userId = session.user.id

    const items = await loadBookableEquipment(database, dedupedEquipmentIds)

    await assertNoConflicts(
      items,
      startTime,
      endTime,
      () => 'Requested time conflicts with existing booking(s)'
    )

    const now = Date.now()
    const userDisplayName = await resolveUserDisplayName({
      database,
      userId,
      sessionUser: session.user,
      userTable: user,
      eq,
    })

    const insertResult = await database
      .insert(booking)
      .values({
        userId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'booked',
        userEventDetails: notes || null,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      })
      .returning({ id: booking.id })

    const bookingId = insertResult[0]?.id
    if (!bookingId) {
      throw new Error('Failed to create booking record')
    }

    try {
      await createItemsWithEvents(database, {
        bookingId,
        items,
        startTime,
        endTime,
        ownerName: userDisplayName,
        notes,
        now,
      })
    } catch (err) {
      try {
        await database.delete(booking).where(eq(booking.id, bookingId))
      } catch (dbDelErr) {
        console.error('Rollback delete failed for booking', bookingId, dbDelErr)
      }

      throw err
    }

    try {
      await logBookingActivityById(bookingId, 'booked')
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
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment, category } =
      await import('@/db/schema')
    const { eq, and, sql } = await import('drizzle-orm')
    const {
      attachItems,
      bookingFilterConditions,
      bookingOrder,
      countBookings,
    } = await import('../list-query')

    const headers = getRequestHeaders()
    const session = await resolveSession(headers)

    if (!session?.user) {
      return null
    }

    const database = db(env.meriksirat_d1 as D1Database)

    const conditions = [
      eq(booking.userId, session.user.id),
      ...bookingFilterConditions(data),
    ]
    if (data.equipmentId) {
      conditions.push(eq(bookingItem.equipmentId, data.equipmentId))
    }
    const whereClause = and(...conditions)

    const [total, pageBookings] = await Promise.all([
      countBookings(database, whereClause),
      database
        .select({
          id: booking.id,
          userId: booking.userId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          userEventDetails: booking.userEventDetails,
          startedAt: booking.startedAt,
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
        .orderBy(bookingOrder(data.sortBy, data.sortOrder))
        .limit(data.limit)
        .offset((data.page - 1) * data.limit),
    ])

    return {
      data: await attachItems(database, pageBookings),
      pagination: buildPageInfo(total, data.page, data.limit),
    }
  })

export const getBookingByIdFn = createServerFn({ method: 'GET' })
  .validator(GetBookingByIdSchema)
  .handler(async ({ data }): Promise<BookingWithItems | null> => {
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { attachItems } = await import('../list-query')

    const headers = getRequestHeaders()
    const session = await resolveSession(headers)

    if (!session?.user) {
      return null
    }

    const database = db(env.meriksirat_d1 as D1Database)

    const [parent] = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        userEventDetails: booking.userEventDetails,
        startedAt: booking.startedAt,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    if (!parent || parent.userId !== session.user.id) return null

    const [result] = await attachItems(database, [parent])
    return result.items.length > 0 ? result : null
  })

export const cancelBookingFn = createServerFn({ method: 'POST' })
  .validator(CancelBookingSchema)
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    const { deleteCalendarEventRaw } =
      await import('@/lib/google/google-calendar-client')
    const { booking, bookingItem, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { recomputeBookingStatus } = await import('../status')

    const { session, database } = await userContext('Not authenticated')

    const userId = session.user.id

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

    if (bookingData.status !== 'booked') {
      throw new Error(
        'Only upcoming bookings can be cancelled. This booking has already started and must be returned through the Telegram bot.'
      )
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

    // Recompute and persist parent status. A failure here must not stop the
    // calendar event cleanup below, otherwise the equipment stays busy after
    // the booking was already cancelled.
    try {
      await recomputeBookingStatus(database, data.bookingId)
    } catch (err) {
      console.error('Failed to recompute booking status on cancel:', err)
    }

    // Log booking cancellation to Telegram channel
    try {
      await logBookingActivityById(data.bookingId, 'cancelled')
    } catch (logError) {
      console.error('Failed to log booking cancellation:', logError)
    }

    // Delete the calendar events for all items
    for (const item of items) {
      if (item.googleCalendarEventId && item.equipmentCalendarId) {
        try {
          await deleteCalendarEventRaw({
            equipmentCalendarId: item.equipmentCalendarId,
            eventId: item.googleCalendarEventId,
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
    const { userContext } = await import('@/lib/auth/context')
    const { toCalendarDateTime, CLUB_TIMEZONE } =
      await import('@/lib/google/google-caledar')
    const { checkCalendarFreeBusyRaw, updateCalendarEventRaw } =
      await import('@/lib/google/google-calendar-client')
    const { booking, bookingItem, equipment, user } =
      await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')

    const { session, database } = await userContext('Not authenticated')

    const userId = session.user.id
    const userDisplayName = await resolveUserDisplayName({
      database,
      userId,
      sessionUser: session.user,
      userTable: user,
      eq,
    })

    // Get the booking to verify ownership
    const bookingItemData = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        startedAt: booking.startedAt,
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
    const newNotes =
      data.notes !== undefined
        ? data.notes
        : bookingData.userEventDetails || undefined

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
      if (
        new Date(newStartTime).getTime() <
        Date.now() + MIN_BOOKING_ADVANCE_MS
      ) {
        throw new Error(
          'Bookings must start at least 1 hour from now. Please select a later time slot.'
        )
      }

      for (const item of items) {
        if (!item.equipmentCalendarId) continue
        const freeBusyResult = await checkCalendarFreeBusyRaw({
          calendarId: item.equipmentCalendarId,
          timeMin: newStartTime,
          timeMax: newEndTime,
        })

        // The booking's own events still occupy the calendar until they are
        // moved below, so exclude them before reporting conflicts. Without
        // this, rescheduling to an overlapping time fails with a false
        // "Requested time conflicts with existing booking" error.
        const { excludeOwnBookingPeriod } = await import('../availability')
        const conflicts = excludeOwnBookingPeriod(
          freeBusyResult.busy,
          bookingData.startedAt ?? bookingData.startTime,
          bookingData.endTime
        )

        if (conflicts.length > 0) {
          const err: Error & { conflict?: (typeof conflicts)[number] } =
            new Error(
              `Requested time conflicts with existing booking for ${item.equipmentModelName || `equipment ${item.equipmentId}`}`
            )
          err.conflict = conflicts[0]
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
      await logBookingActivityById(data.bookingId, 'edited', {
        previous: {
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          eventDetails: bookingData.userEventDetails,
        },
      })
    } catch (logError) {
      console.error('Failed to log booking update:', logError)
    }

    // Update calendar events for each item
    for (const item of items) {
      if (!item.googleCalendarEventId || !item.equipmentCalendarId) continue

      const description = formatBookingDetailsPlain({
        bookingId: data.bookingId,
        userDisplayName,
        equipmentNames: [
          item.equipmentModelName || `Equipment ${item.equipmentId}`,
        ],
        startTime: newStartTime,
        endTime: newEndTime,
        status: bookingData.status,
        notes: newNotes,
      })

      const event = {
        summary: `${item.equipmentModelName || `Equipment ${item.equipmentId}`} - Booking`,
        description,
        start: {
          dateTime: toCalendarDateTime(newStartTime),
          timeZone: CLUB_TIMEZONE,
        },
        end: {
          dateTime: toCalendarDateTime(newEndTime),
          timeZone: CLUB_TIMEZONE,
        },
      }

      try {
        await updateCalendarEventRaw({
          equipmentCalendarId: item.equipmentCalendarId,
          eventId: item.googleCalendarEventId,
          event,
        })
      } catch (err) {
        console.error('Failed to update calendar event:', err)
      }
    }

    return { success: true }
  })
