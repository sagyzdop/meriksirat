/**
 * Telegram Start Booking Command
 *
 * Handles the "Start Booking" flow: shows the user's bookings whose start
 * window is currently open and lets them mark the equipment as picked up.
 */

import type { BotContext } from '../context'
import { db } from '@/db'
import { eq, and, inArray, notInArray } from 'drizzle-orm'
import { user, bookingItem, equipment } from '@/db/schema'
import { setSession } from '../kv-session'
import { withKeyboard } from '../server-utils'
import {
  listStartableBookings,
  startBooking,
} from '@/lib/booking/start-booking'

/**
 * Builds a shared inline keyboard helper: 2 buttons per row.
 */
function buildInlineKeyboard(
  buttons: Array<{ text: string; callback_data: string }>
) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }
  return { reply_markup: { inline_keyboard: rows } }
}

/**
 * Fetches the bookings whose start window is currently open for the user,
 * with the equipment names per booking for the list display.
 */
async function fetchStartableBookings(
  ctx: BotContext,
  userId: string
): Promise<
  Array<{
    id: number
    startTime: Date
    endTime: Date
    equipmentNames: string[]
  }>
> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)
  const startable = await listStartableBookings(database, userId)

  if (startable.length === 0) return []

  const bookingsMap = new Map<
    number,
    { id: number; startTime: Date; endTime: Date; equipmentNames: string[] }
  >()
  for (const b of startable) {
    bookingsMap.set(b.id, {
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      equipmentNames: [],
    })
  }

  const rows = await database
    .select({
      bookingId: bookingItem.bookingId,
      equipmentName: equipment.modelName,
    })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(
        inArray(bookingItem.bookingId, [...bookingsMap.keys()]),
        notInArray(bookingItem.status, ['cancelled', 'returned'])
      )
    )
    .orderBy(bookingItem.id)

  for (const row of rows) {
    const entry = bookingsMap.get(row.bookingId)
    if (entry) {
      entry.equipmentNames.push(row.equipmentName || 'Equipment')
    }
  }

  return [...bookingsMap.values()]
}

/**
 * Handles the "Start Booking" command / button.
 *
 * Flow:
 * 1. Verify user is linked to Telegram account
 * 2. Fetch bookings with an open start window
 * 3. Show a booking list to pick from (confirm happens in the callback step)
 */
export async function handleStartBooking(ctx: BotContext): Promise<void> {
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
      .then((rows) => rows[0])

    if (!userRecord) {
      await ctx.reply(
        'Please link your account via /start first.',
        withKeyboard()
      )
      return
    }

    const bookings = await fetchStartableBookings(ctx, userRecord.id)

    if (bookings.length === 0) {
      await ctx.reply(
        'You have no bookings to start right now.\n\nYour booking can be started up to 15 minutes before its start time, and up to 15 minutes after.',
        withKeyboard()
      )
      return
    }

    await setSession(ctx.env.meriksirat_kv, chatId, {
      step: 'awaiting_start_selection',
      userId: userRecord.id,
      activeBookingIds: bookings.map((b) => b.id),
      createdAt: Date.now(),
    })

    const buttons = bookings.map((b) => ({
      text: `#${b.id} — ${b.equipmentNames.join(', ')}`,
      callback_data: `start_${b.id}`,
    }))

    await ctx.reply(
      'Select which booking to start:',
      buildInlineKeyboard(buttons)
    )
  } catch (error) {
    console.error('Start booking command error:', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    await ctx.reply('Error fetching bookings. Please try again.')
  }
}

/**
 * Starts the given booking for the linked Telegram user.
 * Shared with the callback handler.
 */
export async function startBookingForChat(
  bookingId: number,
  startedByEmail: string,
  ctx: BotContext
): Promise<void> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)
  await startBooking(database, bookingId, { startedBy: startedByEmail })
}
