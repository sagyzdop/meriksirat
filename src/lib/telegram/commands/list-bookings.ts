/**
 * Telegram List Bookings Command
 *
 * Handles /my_bookings - shows the user's active and upcoming bookings
 * with item details and time ranges.
 */

import type { BotContext } from '../context'
import { requireLinkedUser } from '../server-utils'
import { fetchUserBookings } from '../booking-queries'
import { CLUB_TIMEZONE, formatClubTime } from '@/lib/club-time'
import { backToMenuMarkup } from '../menu'
import { BOOKING_STATUS } from '../types'

function formatTimeRange(startTime: Date, endTime: Date): string {
  const date = startTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: CLUB_TIMEZONE,
  })
  const timeStart = formatClubTime(startTime, true)
  const timeEnd = formatClubTime(endTime, true)
  return `${date}, ${timeStart} - ${timeEnd}`
}

/**
 * Renders the user's active/upcoming bookings list. Used by both the text
 * command and the main-menu button so the flow renders in place.
 */
export async function renderMyBookings(ctx: BotContext): Promise<void> {
  const linked = await requireLinkedUser(ctx)
  if (!linked) return

  const bookings = await fetchUserBookings(ctx, linked.userId, [
    BOOKING_STATUS.BOOKED,
    BOOKING_STATUS.ACTIVE,
    BOOKING_STATUS.OVERDUE,
  ])

  if (bookings.length === 0) {
    await ctx.reply(
      'You have no active or upcoming bookings.',
      backToMenuMarkup()
    )
    return
  }

  const lines: string[] = ['Your bookings:']
  for (const b of bookings) {
    const label =
      b.status === BOOKING_STATUS.ACTIVE
        ? 'Active'
        : b.status === BOOKING_STATUS.OVERDUE
          ? 'Overdue'
          : b.status === BOOKING_STATUS.PARTIALLY_RETURNED
            ? 'Partially Returned'
            : 'Upcoming'
    lines.push(`\n${label} - Booking #${b.id}`)
    lines.push(`  ${formatTimeRange(b.startTime, b.endTime)}`)
    for (const it of b.items) {
      lines.push(
        `  - ${it.equipmentName} (${it.itemStatus.replace(/_/g, ' ')})`
      )
    }
  }

  await ctx.reply(lines.join('\n'), backToMenuMarkup())
}
