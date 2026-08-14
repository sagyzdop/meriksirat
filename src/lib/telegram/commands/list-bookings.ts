/**
 * Telegram List Bookings Command
 *
 * Handles /my_bookings - shows the user's active and upcoming bookings
 * with item details and time ranges.
 */

import type { BotContext } from '../context'
import { db } from '@/db'
import { eq, and, inArray } from 'drizzle-orm'
import { user, booking, bookingItem, equipment } from '@/db/schema'
import { removeKeyboard } from '../server-utils'
import { renderInPlace, backToMenuMarkup } from '../menu'
import { BOOKING_STATUS } from '../types'

interface BookingListItem {
  id: number
  startTime: Date
  endTime: Date
  status: string
  items: Array<{
    equipmentName: string
    itemStatus: string
  }>
}

async function fetchListableBookings(
  ctx: BotContext,
  userId: string
): Promise<BookingListItem[]> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const rows = await database
    .select({
      bookingId: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      equipmentName: equipment.modelName,
      itemStatus: bookingItem.status,
    })
    .from(booking)
    .innerJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(
        eq(booking.userId, userId),
        inArray(bookingItem.status, [
          BOOKING_STATUS.BOOKED,
          BOOKING_STATUS.ACTIVE,
          BOOKING_STATUS.OVERDUE,
        ])
      )
    )
    .orderBy(booking.startTime, bookingItem.id)

  const bookingsMap = new Map<number, BookingListItem>()
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
      equipmentName: row.equipmentName,
      itemStatus: row.itemStatus,
    })
  }

  return [...bookingsMap.values()]
}

function formatTimeRange(startTime: Date, endTime: Date): string {
  const date = startTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeStart = startTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const timeEnd = endTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return `${date}, ${timeStart} - ${timeEnd}`
}

/**
 * Renders the user's active/upcoming bookings list. Used by both the text
 * command and the main-menu button so the flow renders in place.
 */
export async function renderMyBookings(ctx: BotContext): Promise<void> {
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

  const bookings = await fetchListableBookings(ctx, userRecord.id)

  if (bookings.length === 0) {
    await renderInPlace(
      ctx,
      'You have no active or upcoming bookings.',
      backToMenuMarkup()
    )
    return
  }

  const now = new Date()
  const lines: string[] = ['Your bookings:']
  for (const b of bookings) {
    const label = b.startTime <= now ? 'Active' : 'Upcoming'
    lines.push(`\n${label} - Booking #${b.id} (${b.status.replace(/_/g, ' ')})`)
    lines.push(`  ${formatTimeRange(b.startTime, b.endTime)}`)
    for (const it of b.items) {
      lines.push(
        `  - ${it.equipmentName} (${it.itemStatus.replace(/_/g, ' ')})`
      )
    }
  }

  await renderInPlace(ctx, lines.join('\n'), backToMenuMarkup())
}

/**
 * Handles the /my_bookings command
 *
 * Flow:
 * 1. Verify user is linked to Telegram account
 * 2. Fetch active and upcoming bookings with items
 * 3. Send a plain-text summary of each booking
 *
 * @param ctx - Bot context with environment bindings
 */
export async function handleListBookings(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.message || !ctx.chat) {
      return
    }

    await renderMyBookings(ctx)
  } catch (error) {
    console.error('List bookings command error:', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    await ctx.reply('Error fetching bookings. Please try again.')
  }
}
