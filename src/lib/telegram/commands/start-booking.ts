/**
 * Telegram Start Booking Command
 *
 * Handles the "Start Booking" flow: shows the user's bookings whose start
 * window is currently open and lets them mark the equipment as picked up.
 * Driven by reply-keyboard buttons whose labels carry the booking id
 * ("Booking #<id> — <equipment>").
 */

import type { BotContext } from '../context'
import { db } from '@/db'
import { eq, and, inArray, notInArray } from 'drizzle-orm'
import { booking, bookingItem, equipment } from '@/db/schema'
import { setSession } from '../kv-session'
import { requireLinkedUser, replyKeyboard } from '../server-utils'
import { formatClubTime } from '@/lib/club-time'
import { BACK_TO_MENU, backToMenuMarkup } from '../menu'
import {
  BookingStartError,
  listStartableBookings,
  startBooking,
} from '@/lib/booking/start-booking'

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
 * Renders the "select which booking to start" list as a reply keyboard.
 */
export async function renderStartBookingList(ctx: BotContext): Promise<void> {
  const linked = await requireLinkedUser(ctx)
  if (!linked) return
  const { chatId, userId } = linked

  const bookings = await fetchStartableBookings(ctx, userId)

  if (bookings.length === 0) {
    await ctx.reply(
      'You have no bookings to start right now.\n\nYour booking can be started up to 15 minutes before its start time, and up to 15 minutes after.',
      backToMenuMarkup()
    )
    return
  }

  await setSession(ctx.env.meriksirat_kv, chatId, {
    step: 'awaiting_start_selection',
    userId,
    activeBookingIds: bookings.map((b) => b.id),
    createdAt: Date.now(),
  })

  const buttons = bookings.map(
    (b) => `Booking #${b.id} — ${b.equipmentNames.join(', ')}`
  )
  buttons.push(BACK_TO_MENU)

  await ctx.reply('Select which booking to start:', replyKeyboard(buttons))
}

/**
 * Renders the "start this booking now?" confirmation with a reply keyboard.
 */
export async function renderStartConfirm(
  ctx: BotContext,
  userId: string,
  bookingId: number
): Promise<boolean> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const parent = await database
    .select({
      startTime: booking.startTime,
      endTime: booking.endTime,
    })
    .from(booking)
    .where(and(eq(booking.id, bookingId), eq(booking.userId, userId)))
    .get()

  if (!parent) {
    await ctx.reply('Booking not found.', backToMenuMarkup())
    return false
  }

  const items = await database
    .select({ equipmentName: equipment.modelName })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(
        eq(bookingItem.bookingId, bookingId),
        notInArray(bookingItem.status, ['cancelled', 'returned'])
      )
    )

  const timeStart = formatClubTime(parent.startTime, true)
  const timeEnd = formatClubTime(parent.endTime, true)
  const equipmentLabel = items.map((i) => i.equipmentName).join(', ')

  await ctx.reply(
    `Start booking #${bookingId} now?\n\n📦 Equipment: ${equipmentLabel}\n🕐 Time: ${timeStart} - ${timeEnd}\n\nTap Confirm to start, or Cancel.`,
    replyKeyboard(['✅ Confirm', 'Cancel', BACK_TO_MENU])
  )
  return true
}

/**
 * Starts the given booking for the linked Telegram user and replies with the
 * result. Shared with the confirm step in the text router.
 */
export async function startBookingForChat(
  ctx: BotContext,
  userId: string,
  bookingId: number
): Promise<void> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)
  try {
    await startBooking(database, bookingId, { onlyForUserId: userId })
  } catch (error) {
    if (error instanceof BookingStartError) {
      await ctx.reply(`${error.message}.`, backToMenuMarkup())
      return
    }
    throw error
  }
  await ctx.reply(
    `✅ Booking #${bookingId} has been started.\n\nThe equipment is now marked as picked up. Use the Return Equipment flow when done.`,
    backToMenuMarkup()
  )
}
