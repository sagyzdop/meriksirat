import { createServerFn } from '@tanstack/react-start'
import {
  AddBookingItemsSchema,
  CancelBookingItemSchema,
  GetBookingByIdSchema,
} from '../types'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type * as schema from '@/db/schema'
import { UserError } from '@/lib/user-error'

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
    throw new UserError('Booking not found')
  }

  if (bookingData.userId !== params.sessionUserId) {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    await checkAdminPermission(params.headers, ['admin', 'manager'])
  }

  // Items may only be added/cancelled while the booking has not been started.
  if (bookingData.status !== 'booked') {
    throw new UserError(
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
    const { userContext } = await import('@/lib/auth/context')
    const { booking, bookingItem, user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { loadBookableEquipment, assertNoConflicts, createItemsWithEvents } =
      await import('../create-items')
    const { formatUserDisplayName } = await import('@/lib/utils')

    const { session, database, headers } =
      await userContext('Not authenticated')

    // Per-user rate limit so a single member cannot spam adding items (each
    // attempt runs free/busy queries + calendar event inserts).
    const { rateLimit } = await import('@/lib/ratelimit')
    const addItemsRateLimit = await rateLimit(
      headers,
      'rl_add_booking_items',
      session.user.id
    )
    if (!addItemsRateLimit.allowed) {
      throw new UserError('Too many requests. Please try again shortly.')
    }

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
      throw new UserError('Booking not found')
    }

    const ownerRow = await database
      .select({
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        telegramUsername: user.telegramUsername,
      })
      .from(user)
      .where(eq(user.id, bookingRow.userId))
      .get()

    const userDisplayName = formatUserDisplayName(ownerRow ?? {})

    const existingItems = await database
      .select({ equipmentId: bookingItem.equipmentId })
      .from(bookingItem)
      .where(eq(bookingItem.bookingId, data.bookingId))
    const existingIds = new Set(existingItems.map((item) => item.equipmentId))

    const equipmentIds = data.equipmentIds.filter((id) => !existingIds.has(id))
    if (equipmentIds.length === 0) {
      throw new UserError('Selected equipment is already part of this booking')
    }

    const items = await loadBookableEquipment(database, equipmentIds)

    const startTime = new Date(bookingRow.startTime).toISOString()
    const endTime = new Date(bookingRow.endTime).toISOString()

    const nameById = new Map(items.map((item) => [item.equipmentId, item.name]))
    await assertNoConflicts(
      items,
      startTime,
      endTime,
      (conflicts) =>
        `Requested time conflicts with existing booking(s) for ${conflicts
          .map(({ equipmentId }) => nameById.get(equipmentId))
          .join(', ')}`
    )

    const now = Date.now()
    const added = await createItemsWithEvents(database, {
      bookingId: data.bookingId,
      items,
      startTime,
      endTime,
      ownerName: userDisplayName,
      notes: bookingRow.userEventDetails,
      now,
    })

    await database
      .update(booking)
      .set({ updatedAt: new Date(now) })
      .where(eq(booking.id, data.bookingId))

    try {
      await logBookingActivityById(data.bookingId, 'items_added', {
        addedItems: items.map((item) => item.name),
      })
    } catch (logError) {
      console.error('Failed to log booking update:', logError)
    }

    return { success: true, added }
  })

export const cancelBookingItemFn = createServerFn({ method: 'POST' })
  .validator(CancelBookingItemSchema)
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { cancelBookingItems } = await import('../booking-items')
    const { bookingItem } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { itemBelongsToBooking } = await import('../ownership')

    const { session, database, headers } =
      await userContext('Not authenticated')

    await assertBookingAccess({
      headers,
      database,
      bookingId: data.bookingId,
      sessionUserId: session.user.id,
    })

    const itemRow = await database
      .select({ bookingId: bookingItem.bookingId })
      .from(bookingItem)
      .where(eq(bookingItem.id, data.itemId))
      .get()

    if (!itemBelongsToBooking(itemRow?.bookingId, data.bookingId)) {
      throw new UserError('Item not found')
    }

    const result = await cancelBookingItems(database, [data.itemId])

    if (result.updated.length === 0) {
      throw new UserError('Item is already cancelled or returned')
    }

    for (const bookingId of result.touchedBookings) {
      try {
        await logBookingActivityById(bookingId, 'cancelled')
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
    const { userContext } = await import('@/lib/auth/context')
    const { bookingItem } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { session, database, headers } =
      await userContext('Not authenticated')

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
    const { userContext } = await import('@/lib/auth/context')
    const { booking } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { session, database, headers } =
      await userContext('Not authenticated')

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
      throw new UserError('Booking not found')
    }

    return {
      startTime: new Date(row.startTime).toISOString(),
      endTime: new Date(row.endTime).toISOString(),
    }
  })
