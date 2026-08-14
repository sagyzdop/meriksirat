import type { BotContext } from '../context'
import { db } from '@/db'
import { eq, and, inArray, lt } from 'drizzle-orm'
import { user, booking, bookingItem, equipment } from '@/db/schema'
import { setSession } from '../kv-session'
import { BOOKING_STATUS } from '../types'
import { inlineKeyboard, removeKeyboard } from '../server-utils'
import { renderInPlace, backToMenuMarkup, backToMenuButton } from '../menu'

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
 * Renders the "select which booking to return" list. Used by both the text
 * command and the main-menu button so the flow renders in place.
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

  // Always show the booking list first so the user can confirm which booking
  // they are returning equipment for.
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
  buttons.push(backToMenuButton())

  await renderInPlace(
    ctx,
    'Select which booking to return:',
    inlineKeyboard(buttons)
  )
}

/**
 * Handles the /return_equipment command to initiate equipment return flow
 *
 * Flow:
 * 1. Verify user is linked to Telegram account
 * 2. Fetch bookings with returnable items
 * 3. Show a booking list to pick from
 *
 * @param ctx - Bot context with environment bindings
 */
export async function handleEndBooking(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.message || !ctx.chat) {
      return
    }

    await renderEndBookingList(ctx)
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
