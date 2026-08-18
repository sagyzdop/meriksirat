import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import {
  AddBookingItemsSchema,
  CancelBookingItemSchema,
  GetBookingByIdSchema,
} from '../types'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type * as schema from '@/db/schema'

/**
 * Per-item booking action for the web UI.
 *
 * Cancelling an item delegates to the shared booking-items logic (the same
 * logic used by the Telegram bot /cancel_booking flow). Returns are handled
 * through Telegram, so there is no web return action.
 */

async function assertBookingAccess(params: {
  headers: Headers
  database: DrizzleD1Database<typeof schema>
  bookingId: number
  sessionUserId: string
}) {
  const { booking } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')

  const bookingRow = await params.database
    .select({ userId: booking.userId, status: booking.status })
    .from(booking)
    .where(eq(booking.id, params.bookingId))
    .limit(1)

  const bookingData = bookingRow[0]
  if (!bookingData) {
    throw new Error('Booking not found')
  }

  if (bookingData.userId !== params.sessionUserId) {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    await checkAdminPermission(params.headers, ['admin', 'manager'])
  }

  // Items may only be added/cancelled while the booking has not been started.
  if (bookingData.status !== 'booked') {
    throw new Error(
      'Items can only be added or cancelled while the booking has not started'
    )
  }
}

/**
 * addBookingItemsFn: adds one or more pieces of equipment to an existing
 * booked booking. Each new item gets its own Google Calendar event within the
 * booking's time window (after a free/busy conflict check). Only bookings that
 * have not started can be extended this way.
 */
export const addBookingItemsFn = createServerFn({ method: 'POST' })
  .validator(AddBookingItemsSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment, user } =
      await import('@/db/schema')
    const { eq, inArray } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { toCalendarDateTime, CLUB_TIMEZONE } =
      await import('@/lib/google/google-caledar')
    const {
      createCalendarEventRaw,
      checkMultipleCalendarsFreeBusyRaw,
      deleteCalendarEventRaw,
    } = await import('@/lib/google/google-calendar-client')
    const { getEquipmentCalendarId, retry } = await import('../server')
    const { formatBookingDetailsPlain } = await import('../details')
    const { formatUserDisplayName } = await import('@/lib/utils')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })
    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    // Per-user rate limit so a single member cannot spam adding items (each
    // attempt runs free/busy queries + calendar event inserts).
    const { rateLimit } = await import('@/lib/ratelimit')
    const addItemsRateLimit = await rateLimit(
      headers,
      'rl_add_booking_items',
      session.user.id
    )
    if (!addItemsRateLimit.allowed) {
      throw new Error('Too many requests. Please try again shortly.')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    await assertBookingAccess({
      headers,
      database,
      bookingId: data.bookingId,
      sessionUserId: session.user.id,
    })

    const bookingRow = await database
      .select({
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userEventDetails: booking.userEventDetails,
      })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .get()

    if (!bookingRow) {
      throw new Error('Booking not found')
    }

    const ownerRow = await database
      .select({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        telegramUsername: user.telegramUsername,
      })
      .from(user)
      .where(eq(user.id, bookingRow.userId))
      .get()

    const userEmail = ownerRow?.email || session.user.email || ''
    const userDisplayName = formatUserDisplayName(ownerRow ?? {})

    const existingItems = await database
      .select({ equipmentId: bookingItem.equipmentId })
      .from(bookingItem)
      .where(eq(bookingItem.bookingId, data.bookingId))
    const existingIds = new Set(existingItems.map((item) => item.equipmentId))

    const equipmentIds = data.equipmentIds.filter((id) => !existingIds.has(id))
    if (equipmentIds.length === 0) {
      throw new Error('Selected equipment is already part of this booking')
    }

    const equipmentCalendarIds = await Promise.all(
      equipmentIds.map(async (equipmentId) => ({
        equipmentId,
        calendarId: await getEquipmentCalendarId(equipmentId),
      }))
    )

    const missingCalendar = equipmentCalendarIds.find(
      (item) => !item.calendarId
    )
    if (missingCalendar) {
      throw new Error(
        `No calendar configured for equipment ${missingCalendar.equipmentId}`
      )
    }

    const resolvedCalendars = equipmentCalendarIds.map((item) => ({
      equipmentId: item.equipmentId,
      calendarId: item.calendarId as string,
    }))

    const calendarIds = resolvedCalendars.map((item) => item.calendarId)

    const equipmentData = await database
      .select({ id: equipment.id, modelName: equipment.modelName })
      .from(equipment)
      .where(inArray(equipment.id, equipmentIds))

    const equipmentNameMap = new Map(
      equipmentData.map((item) => [item.id, item.modelName])
    )

    const startTime = new Date(bookingRow.startTime).toISOString()
    const endTime = new Date(bookingRow.endTime).toISOString()

    const freeBusyResult = await checkMultipleCalendarsFreeBusyRaw({
      equipmentCalendarIds: calendarIds,
      timeMin: startTime,
      timeMax: endTime,
    })

    const conflicts = resolvedCalendars
      .map(({ equipmentId, calendarId }) => {
        const busy = freeBusyResult[calendarId]?.busy || []
        return busy.length > 0 ? { equipmentId, conflict: busy[0] } : null
      })
      .filter(
        (
          item
        ): item is {
          equipmentId: number
          conflict: { start: string; end: string }
        } => Boolean(item)
      )

    if (conflicts.length > 0) {
      const conflictNames = conflicts
        .map(
          ({ equipmentId }) =>
            equipmentNameMap.get(equipmentId) || `Equipment ${equipmentId}`
        )
        .join(', ')
      const err: Error & { conflicts?: typeof conflicts } = new Error(
        `Requested time conflicts with existing booking(s) for ${conflictNames}`
      )
      err.conflicts = conflicts
      throw err
    }

    const notes = bookingRow.userEventDetails

    const now = Date.now()
    const createdItems: Array<{
      bookingItemId: number
      calendarId: string
      eventId: string
    }> = []

    try {
      for (const { equipmentId, calendarId } of resolvedCalendars) {
        const equipmentName =
          equipmentNameMap.get(equipmentId) || `Equipment ${equipmentId}`
        const description = formatBookingDetailsPlain({
          bookingId: data.bookingId,
          userDisplayName,
          equipmentNames: [equipmentName],
          startTime,
          endTime,
          status: 'booked',
          notes,
        })

        const event = {
          summary: `${equipmentName} - Booking`,
          description,
          start: {
            dateTime: toCalendarDateTime(startTime),
            timeZone: CLUB_TIMEZONE,
          },
          end: {
            dateTime: toCalendarDateTime(endTime),
            timeZone: CLUB_TIMEZONE,
          },
        }

        const createdEvent = await retry(
          () =>
            createCalendarEventRaw({
              equipmentCalendarId: calendarId,
              event,
              userEmail,
            }),
          3,
          400
        )

        const gCalEventId = createdEvent?.eventId
        if (!gCalEventId) {
          throw new Error('Calendar API responded without event id')
        }

        const itemInsert = await database
          .insert(bookingItem)
          .values({
            bookingId: data.bookingId,
            equipmentId,
            status: 'booked',
            googleCalendarEventId: gCalEventId,
            createdAt: new Date(now),
            updatedAt: new Date(now),
          })
          .returning({ id: bookingItem.id })

        const bookingItemId = itemInsert[0]?.id
        if (!bookingItemId) {
          throw new Error('Failed to create booking item record')
        }

        createdItems.push({ bookingItemId, calendarId, eventId: gCalEventId })
      }
    } catch (err) {
      // Rollback: delete created events and items
      for (const record of createdItems) {
        try {
          await deleteCalendarEventRaw({
            equipmentCalendarId: record.calendarId,
            eventId: record.eventId,
          })
        } catch (deleteError) {
          console.error(
            'Failed to delete calendar event during rollback:',
            deleteError
          )
        }

        try {
          await database
            .delete(bookingItem)
            .where(eq(bookingItem.id, record.bookingItemId))
        } catch (dbDelErr) {
          console.error(
            'Rollback delete failed for booking item',
            record.bookingItemId,
            dbDelErr
          )
        }
      }

      throw err
    }

    await database
      .update(booking)
      .set({ updatedAt: new Date(now) })
      .where(eq(booking.id, data.bookingId))

    try {
      await logBookingActivityById(data.bookingId, 'updated', {
        notes: `Added equipment to booking: ${equipmentIds.map((id) => equipmentNameMap.get(id) || `Equipment ${id}`).join(', ')}`,
      })
    } catch (logError) {
      console.error('Failed to log booking update:', logError)
    }

    return { success: true, added: createdItems.length }
  })

export const cancelBookingItemFn = createServerFn({ method: 'POST' })
  .validator(CancelBookingItemSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { cancelBookingItems } = await import('../booking-items')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })
    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    await assertBookingAccess({
      headers,
      database,
      bookingId: data.bookingId,
      sessionUserId: session.user.id,
    })

    const result = await cancelBookingItems(database, [data.itemId])

    if (result.updated.length === 0) {
      throw new Error('Item is already cancelled or returned')
    }

    for (const bookingId of result.touchedBookings) {
      try {
        await logBookingActivityById(bookingId, 'cancelled', {
          newStatus: 'cancelled',
          notes: 'Item cancelled via web',
        })
      } catch (logError) {
        console.error('Failed to log item cancellation:', logError)
      }
    }

    return { success: true }
  })

/**
 * getBookingItemEquipmentIdsFn returns the equipment already attached to a
 * booking. Used by the equipment catalog in add-to-booking mode so already
 * booked items can be marked and excluded from selection.
 */
export const getBookingItemEquipmentIdsFn = createServerFn({ method: 'POST' })
  .validator(GetBookingByIdSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { bookingItem } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })
    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    await assertBookingAccess({
      headers,
      database,
      bookingId: data.bookingId,
      sessionUserId: session.user.id,
    })

    const items = await database
      .select({ equipmentId: bookingItem.equipmentId })
      .from(bookingItem)
      .where(eq(bookingItem.bookingId, data.bookingId))

    return { equipmentIds: items.map((item) => item.equipmentId) }
  })

/**
 * getBookingWindowFn returns the start/end time of a booking. Used by the
 * equipment catalog in add-to-booking mode so availability for the selected
 * items can be checked against the booking's time window before adding them.
 */
export const getBookingWindowFn = createServerFn({ method: 'POST' })
  .validator(GetBookingByIdSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })
    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    await assertBookingAccess({
      headers,
      database,
      bookingId: data.bookingId,
      sessionUserId: session.user.id,
    })

    const row = await database
      .select({ startTime: booking.startTime, endTime: booking.endTime })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .get()

    if (!row) {
      throw new Error('Booking not found')
    }

    return {
      startTime: new Date(row.startTime).toISOString(),
      endTime: new Date(row.endTime).toISOString(),
    }
  })
