/**
 * Telegram Return Equipment Command
 *
 * Handles the equipment return flow (formerly "End Booking"): the user picks
 * the booking and then the items to return, and sends a photo as proof.
 * Driven by reply-keyboard buttons whose labels carry the booking/item ids.
 */

import type { BotContext } from '../context'
import { db } from '@/db'
import { eq, and, inArray } from 'drizzle-orm'
import { user, booking, bookingItem, equipment } from '@/db/schema'
import { setSession } from '../kv-session'
import { BOOKING_STATUS } from '../types'
import { removeKeyboard, replyKeyboard } from '../server-utils'
import { renderInPlace, backToMenuButton, backToMenuMarkup } from '../menu'

interface BookingWithItems {
  id: number
  startTime: Date
  endTime: Date
  items: Array<{
    itemId: number
    equipmentName: string
  }>
}

/**
 * Fetch the user's bookings that still have returnable items.
 *
 * Only items that were actually picked up (`active` or `overdue`) are
 * returnable. Items still `booked` were never picked up and must be cancelled
 * through the cancel flow instead. There is deliberately no time filter here:
 * a booking started up to 15 minutes early has `active` items while its start
 * time is still in the future, and those must still be returnable.
 */
async function fetchReturnableBookings(
  ctx: BotContext,
  userId: string
): Promise<BookingWithItems[]> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const rows = await database
    .select({
      bookingId: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      itemId: bookingItem.id,
      equipmentName: equipment.modelName,
    })
    .from(booking)
    .innerJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(
        eq(booking.userId, userId),
        inArray(bookingItem.status, [
          BOOKING_STATUS.ACTIVE,
          BOOKING_STATUS.OVERDUE,
        ])
      )
    )
    .orderBy(booking.startTime, bookingItem.id)

  const bookingsMap = new Map<number, BookingWithItems>()
  for (const row of rows) {
    let entry = bookingsMap.get(row.bookingId)
    if (!entry) {
      entry = {
        id: row.bookingId,
        startTime: row.startTime,
        endTime: row.endTime,
        items: [],
      }
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
 * Renders the "select which booking to return" list as a reply keyboard.
 */
export async function renderEndBookingList(ctx: BotContext): Promise<void> {
  const chatId = String(ctx.chat?.id)
  if (!chatId) return

  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const userRecord = await database
    .select()
    .from(user)
    .where(eq(user.telegramChatId, chatId))
    .limit(1)
    .then((rows) => rows[0])

  if (!userRecord) {
    await renderInPlace(
      ctx,
      'Please link your account via /start first.',
      removeKeyboard()
    )
    return
  }

  const bookings = await fetchReturnableBookings(ctx, userRecord.id)

  if (bookings.length === 0) {
    await renderInPlace(
      ctx,
      'You have no active bookings to return.',
      backToMenuMarkup()
    )
    return
  }

  const activeBookingIds = bookings.map((b) => b.id)

  await setSession(ctx.env.meriksirat_kv, chatId, {
    step: 'awaiting_booking_selection',
    userId: userRecord.id,
    activeBookingIds,
    createdAt: Date.now(),
  })

  const buttons = bookings.map(
    (b) =>
      `Booking #${b.id} — ${b.items.map((it) => it.equipmentName).join(', ')}`
  )
  buttons.push(backToMenuButton())

  await renderInPlace(
    ctx,
    'Select which booking to return:',
    replyKeyboard(buttons)
  )
}

/**
 * Returns the returnable (active/overdue) items of a booking, ordered by id.
 * Shared between the item-selection renderer and the text router, which maps
 * the tapped number back to an item id.
 */
export async function getReturnableItemsForBooking(
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
        inArray(bookingItem.status, [
          BOOKING_STATUS.ACTIVE,
          BOOKING_STATUS.OVERDUE,
        ])
      )
    )
    .orderBy(bookingItem.id)
}

/**
 * Renders the "select which items to return" list for a booking as a reply
 * keyboard of numbered item labels.
 */
export async function renderReturnItemSelection(
  ctx: BotContext,
  bookingId: number
): Promise<void> {
  const chatId = String(ctx.chat?.id)
  if (!chatId) return

  const userRecord = await db(ctx.env.meriksirat_d1 as D1Database)
    .select()
    .from(user)
    .where(eq(user.telegramChatId, chatId))
    .limit(1)
    .then((rows) => rows[0])

  if (!userRecord) {
    await renderInPlace(
      ctx,
      'Please link your account via /start first.',
      removeKeyboard()
    )
    return
  }

  const items = await getReturnableItemsForBooking(
    ctx,
    userRecord.id,
    bookingId
  )

  if (items.length === 0) {
    await ctx.reply('No items to return for this booking.', backToMenuMarkup())
    await renderEndBookingList(ctx)
    return
  }

  await setSession(ctx.env.meriksirat_kv, chatId, {
    step: 'awaiting_item_selection',
    userId: userRecord.id,
    activeBookingIds: [bookingId],
    selectedBookingIds: [bookingId],
    createdAt: Date.now(),
  })

  const lines = [
    `Select which items to return for booking #${bookingId}:`,
    ...items.map((it, index) => `${index + 1}. ${it.equipmentName}`),
  ]

  const buttons = items.map((_, index) => String(index + 1))
  buttons.push('Return All Items')
  buttons.push(backToMenuButton())

  await ctx.reply(lines.join('\n'), replyKeyboard(buttons))
}

/**
 * Handles the /return_equipment command to initiate the equipment return flow.
 */
export async function handleEndBooking(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.message || !ctx.chat) {
      return
    }

    await renderEndBookingList(ctx)
  } catch (error) {
    console.error('Return equipment command error:', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    await ctx.reply('Error fetching bookings. Please try again.')
  }
}
