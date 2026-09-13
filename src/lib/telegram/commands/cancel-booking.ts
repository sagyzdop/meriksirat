/**
 * Telegram Cancel Booking Command
 *
 * Handles /cancel_booking - per-item or per-booking (all items) cancellation
 * of upcoming bookings. Cancellation is only allowed for items still in the
 * `booked` status (equipment that was never picked up). Once a booking has
 * been started (items `active`/`overdue`) the equipment must be returned
 * through the return flow instead.
 *
 * The flow is nested, matching the return flow: the user first picks a
 * booking, then individual items or all of them. Driven by reply-keyboard
 * buttons whose labels carry the booking id or a numbered item index.
 */

import type { BotContext } from '../context'
import { db } from '@/db'
import { eq, and, inArray } from 'drizzle-orm'
import { user, booking, bookingItem, equipment } from '@/db/schema'
import { removeKeyboard, replyKeyboard } from '../server-utils'
import { BOOKING_STATUS } from '../types'
import { logBookingActivityById } from '../logging'
import { cancelBookingItems } from '@/lib/booking/booking-items'
import { renderInPlace, backToMenuButton, backToMenuMarkup } from '../menu'

interface CancellableBooking {
  id: number
  items: Array<{
    itemId: number
    equipmentName: string
  }>
}

export async function getUserIdByChatId(
  ctx: BotContext,
  chatId: string
): Promise<string | null> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)
  const userRecord = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.telegramChatId, chatId))
    .limit(1)
    .then((rows) => rows[0])
  return userRecord?.id ?? null
}

/**
 * Fetch the user's bookings that still have cancellable (not yet picked up)
 * items, i.e. items still in the `booked` status.
 */
async function fetchCancellableBookings(
  ctx: BotContext,
  userId: string
): Promise<CancellableBooking[]> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const rows = await database
    .select({
      bookingId: booking.id,
      itemId: bookingItem.id,
      equipmentName: equipment.modelName,
    })
    .from(booking)
    .innerJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(
        eq(booking.userId, userId),
        eq(bookingItem.status, BOOKING_STATUS.BOOKED)
      )
    )
    .orderBy(booking.startTime, bookingItem.id)

  const bookingsMap = new Map<number, CancellableBooking>()
  for (const row of rows) {
    let entry = bookingsMap.get(row.bookingId)
    if (!entry) {
      entry = { id: row.bookingId, items: [] }
      bookingsMap.set(row.bookingId, entry)
    }
    entry.items.push({
      itemId: row.itemId,
      equipmentName: row.equipmentName,
    })
  }

  return [...bookingsMap.values()]
}

/**
 * Cancels the given set of booking items, reusing the shared per-item
 * cancellation logic (recompute parent statuses, log activity, delete gcal
 * events). Only items still in the `booked` status can be cancelled, re-checked
 * here so a stale selection cannot cancel picked-up equipment.
 */
export async function cancelItems(
  ctx: BotContext,
  userId: string,
  itemIds: number[]
): Promise<{ ok: boolean; message: string }> {
  if (itemIds.length === 0) {
    return { ok: false, message: 'No cancellable items found.' }
  }

  const database = db(ctx.env.meriksirat_d1 as D1Database)

  // Verify ownership and keep only the caller's items
  const ownedRows = await database
    .select({ id: bookingItem.id, status: bookingItem.status })
    .from(bookingItem)
    .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
    .where(and(inArray(bookingItem.id, itemIds), eq(booking.userId, userId)))

  if (ownedRows.length === 0) {
    return { ok: false, message: 'Item not found.' }
  }

  const bookedRows = ownedRows.filter((r) => r.status === BOOKING_STATUS.BOOKED)

  if (bookedRows.length === 0) {
    return {
      ok: false,
      message:
        'This item has already been picked up and can only be cancelled while it is still booked. Use the Return Equipment flow instead.',
    }
  }

  const result = await cancelBookingItems(
    database,
    bookedRows.map((r) => r.id)
  )

  if (result.updated.length === 0) {
    return {
      ok: false,
      message: 'The selected items are already cancelled or returned.',
    }
  }

  for (const bookingId of result.touchedBookings) {
    try {
      await logBookingActivityById(bookingId, 'cancelled', {
        previousStatus: result.updated.find((it) => it.bookingId === bookingId)
          ?.itemStatus,
        newStatus: 'cancelled',
      })
    } catch (logError) {
      console.error('Failed to log item cancellation:', logError)
    }
  }

  const names = result.updated.map((it) => it.equipmentName).join(', ')
  const bookingsStr = [...result.touchedBookings]
    .sort((a, b) => a - b)
    .map((b) => `#${b}`)
    .join(', ')

  return {
    ok: true,
    message: `Cancelled ${names} (booking ${bookingsStr}).`,
  }
}

/**
 * Collects the ids of all still-`booked` items of a booking owned by the user.
 */
export async function collectCancellableItemIds(
  ctx: BotContext,
  userId: string,
  bookingId: number
): Promise<number[]> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const rows = await database
    .select({ itemId: bookingItem.id })
    .from(bookingItem)
    .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
    .where(
      and(
        eq(bookingItem.bookingId, bookingId),
        eq(booking.userId, userId),
        eq(bookingItem.status, BOOKING_STATUS.BOOKED)
      )
    )

  return rows.map((r) => r.itemId)
}

/**
 * Renders the "select which booking to cancel" list as a reply keyboard.
 */
export async function renderCancelBookingList(ctx: BotContext): Promise<void> {
  const chatId = String(ctx.chat?.id)
  if (!chatId) return

  const userId = await getUserIdByChatId(ctx, chatId)

  if (!userId) {
    await renderInPlace(
      ctx,
      'Please link your account via /start first.',
      removeKeyboard()
    )
    return
  }

  const bookings = await fetchCancellableBookings(ctx, userId)

  if (bookings.length === 0) {
    await renderInPlace(
      ctx,
      'You have no upcoming bookings to cancel.',
      backToMenuMarkup()
    )
    return
  }

  const buttons = bookings.map(
    (b) =>
      `Booking #${b.id} — ${b.items.map((it) => it.equipmentName).join(', ')}`
  )
  buttons.push(backToMenuButton())

  await renderInPlace(
    ctx,
    'Select which booking to cancel:',
    replyKeyboard(buttons)
  )
}

/**
 * Returns the still-`booked` items of a booking owned by the user, ordered by
 * id. Shared between the item-selection renderer and the text router, which
 * maps the tapped number back to an item id.
 */
export async function getCancellableItemsForBooking(
  ctx: BotContext,
  userId: string,
  bookingId: number
): Promise<Array<{ itemId: number; equipmentName: string }>> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  return await database
    .select({
      itemId: bookingItem.id,
      equipmentName: equipment.modelName,
    })
    .from(bookingItem)
    .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(
        eq(bookingItem.bookingId, bookingId),
        eq(booking.userId, userId),
        eq(bookingItem.status, BOOKING_STATUS.BOOKED)
      )
    )
    .orderBy(bookingItem.id)
}

/**
 * Renders the "select item(s) to cancel" list for a single booking as a reply
 * keyboard of numbered item labels.
 */
export async function renderCancelBookingItems(
  ctx: BotContext,
  bookingId: number
): Promise<void> {
  const chatId = String(ctx.chat?.id)
  if (!chatId) return

  const userId = await getUserIdByChatId(ctx, chatId)

  if (!userId) {
    await renderInPlace(
      ctx,
      'Please link your account via /start first.',
      removeKeyboard()
    )
    return
  }

  const items = await getCancellableItemsForBooking(ctx, userId, bookingId)

  if (items.length === 0) {
    await ctx.reply(
      `Booking #${bookingId} has no cancellable items left.`,
      backToMenuMarkup()
    )
    return
  }

  const messageLines: string[] = [
    `Booking #${bookingId}`,
    ...items.map((it, index) => `  ${index + 1}. ${it.equipmentName}`),
    '',
    'Send the number of the item you want to cancel:',
  ]

  const buttons = items.map((_, index) => String(index + 1))
  buttons.push(`Cancel All Items (${items.length})`)
  buttons.push('⬅️ Back to bookings')
  buttons.push(backToMenuButton())

  await ctx.reply(messageLines.join('\n'), replyKeyboard(buttons))
}

/**
 * Handles the /cancel_booking command.
 */
export async function handleCancelBooking(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.message || !ctx.chat) {
      return
    }

    await renderCancelBookingList(ctx)
  } catch (error) {
    console.error('Cancel booking command error:', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    await ctx.reply('Error fetching bookings. Please try again.')
  }
}
