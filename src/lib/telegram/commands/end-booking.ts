import type { BotContext } from '../context'
import { db } from '@/db'
import { eq, and, inArray, lt } from 'drizzle-orm'
import { user, booking, bookingItem, equipment } from '@/db/schema'
import { setSession } from '../kv-session'
import { BOOKING_STATUS } from '../types'
import { withKeyboard } from '../server-utils'

interface BookingWithItems {
  id: number
  startTime: Date
  endTime: Date
  status: string
  items: Array<{
    itemId: number
    itemStatus: string
    equipmentName: string
  }>
}

/**
 * Builds a shared inline keyboard helper: 2 buttons per row.
 */
function buildInlineKeyboard(buttons: Array<{ text: string; callback_data: string }>) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }
  return { reply_markup: { inline_keyboard: rows } }
}

/**
 * Fetch the user's bookings that still have returnable items
 * (items that are not yet returned or cancelled).
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
      status: booking.status,
      itemId: bookingItem.id,
      itemStatus: bookingItem.status,
      equipmentName: equipment.modelName,
    })
    .from(booking)
    .innerJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(
        eq(booking.userId, userId),
        lt(booking.startTime, new Date()),
        inArray(bookingItem.status, [
          BOOKING_STATUS.BOOKED,
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
        status: row.status,
        items: [],
      }
      bookingsMap.set(row.bookingId, entry)
    }
    entry.items.push({
      itemId: row.itemId,
      itemStatus: row.itemStatus,
      equipmentName: row.equipmentName,
    })
  }

  return [...bookingsMap.values()]
}

/**
 * Present the item-selection keyboard for a single booking.
 */
async function promptItemSelection(
  ctx: BotContext,
  chatId: string,
  userId: string,
  bookingInfo: BookingWithItems
): Promise<void> {
  const returnableItems = bookingInfo.items.filter(
    (it) => it.itemStatus !== 'returned' && it.itemStatus !== 'cancelled'
  )

  await setSession(ctx.env.meriksirat_kv, chatId, {
    step: 'awaiting_item_selection',
    userId,
    activeBookingIds: [bookingInfo.id],
    selectedBookingIds: [bookingInfo.id],
    createdAt: Date.now(),
  })

  const buttons = returnableItems.map((it) => ({
    text: it.equipmentName,
    callback_data: `item_${it.itemId}`,
  }))
  buttons.push({
    text: 'Return All Items',
    callback_data: `item_all_${bookingInfo.id}`,
  })

  await ctx.reply(
    `Select which items to return for booking #${bookingInfo.id}:`,
    buildInlineKeyboard(buttons)
  )
}

/**
 * Handles the /return_equipment command to initiate equipment return flow
 *
 * Flow:
 * 1. Verify user is linked to Telegram account
 * 2. Fetch bookings with returnable items
 * 3. If a single booking exists, go straight to item selection
 * 4. If multiple bookings exist, show a booking list to pick from
 *
 * @param ctx - Bot context with environment bindings
 */
export async function handleEndBooking(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.message || !ctx.chat) {
      return
    }

    const chatId = String(ctx.chat.id)
    const database = db(ctx.env.meriksirat_d1 as D1Database)

    const userRecord = await database
      .select()
      .from(user)
      .where(eq(user.telegramChatId, chatId))
      .limit(1)
      .then(rows => rows[0])

    if (!userRecord) {
      await ctx.reply(
        'Please link your account via /start first.',
        withKeyboard()
      )
      return
    }

    const bookings = await fetchReturnableBookings(ctx, userRecord.id)

    if (bookings.length === 0) {
      await ctx.reply(
        'You have no active bookings to return.',
        withKeyboard()
      )
      return
    }

    const activeBookingIds = bookings.map((b) => b.id)

    // Single booking: skip booking selection and go straight to items
    if (bookings.length === 1) {
      await promptItemSelection(ctx, chatId, userRecord.id, bookings[0])
      return
    }

    // Multiple bookings: ask which booking to return
    await setSession(ctx.env.meriksirat_kv, chatId, {
      step: 'awaiting_booking_selection',
      userId: userRecord.id,
      activeBookingIds,
      createdAt: Date.now(),
    })

    const buttons = bookings.map((b) => ({
      text: `#${b.id} — ${b.items.map((it) => it.equipmentName).join(', ')}`,
      callback_data: `book_${b.id}`,
    }))

    await ctx.reply(
      'Select which booking to return:',
      buildInlineKeyboard(buttons)
    )

  } catch (error) {
    console.error('End booking command error:', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    await ctx.reply('Error fetching bookings. Please try again.')
  }
}
