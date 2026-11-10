/**
 * Telegram Return Equipment Command
 *
 * Handles the equipment return flow (formerly "End Booking"): the user picks
 * the booking and then the items to return, and sends a photo as proof.
 * Driven by reply-keyboard buttons whose labels carry the booking/item ids.
 */

import type { BotContext } from '../context'
import { setSession } from '../session'
import { BOOKING_STATUS } from '../types'
import { requireLinkedUser, replyKeyboard } from '../server-utils'
import { BACK_TO_MENU, backToMenuMarkup } from '../menu'
import { fetchUserBookings, fetchBookingItems } from '../booking-queries'

/**
 * Only items that were actually picked up (`active` or `overdue`) are
 * returnable. Items still `booked` were never picked up and must be cancelled
 * through the cancel flow instead. There is deliberately no time filter: a
 * booking started up to 15 minutes early has `active` items while its start
 * time is still in the future, and those must still be returnable.
 */
export const RETURNABLE_STATUSES = [
  BOOKING_STATUS.ACTIVE,
  BOOKING_STATUS.OVERDUE,
]

/**
 * Renders the "select which booking to return" list as a reply keyboard.
 */
export async function renderEndBookingList(ctx: BotContext): Promise<void> {
  const linked = await requireLinkedUser(ctx)
  if (!linked) return
  const { chatId, userId } = linked

  const bookings = await fetchUserBookings(ctx, userId, RETURNABLE_STATUSES)

  if (bookings.length === 0) {
    await ctx.reply(
      'You have no active bookings to return.',
      backToMenuMarkup()
    )
    return
  }

  const activeBookingIds = bookings.map((b) => b.id)

  await setSession(chatId, {
    step: 'awaiting_booking_selection',
    userId,
    activeBookingIds,
    createdAt: Date.now(),
  })

  const buttons = bookings.map(
    (b) =>
      `Booking #${b.id} — ${b.items.map((it) => it.equipmentName).join(', ')}`
  )
  buttons.push(BACK_TO_MENU)

  await ctx.reply('Select which booking to return:', replyKeyboard(buttons))
}

/**
 * Renders the "select which items to return" list for a booking as a reply
 * keyboard of numbered item labels.
 */
export async function renderReturnItemSelection(
  ctx: BotContext,
  bookingId: number
): Promise<void> {
  const linked = await requireLinkedUser(ctx)
  if (!linked) return
  const { chatId, userId } = linked

  const items = await fetchBookingItems(
    ctx,
    userId,
    bookingId,
    RETURNABLE_STATUSES
  )

  if (items.length === 0) {
    await ctx.reply('No items to return for this booking.', backToMenuMarkup())
    await renderEndBookingList(ctx)
    return
  }

  await setSession(chatId, {
    step: 'awaiting_item_selection',
    userId,
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
  buttons.push(BACK_TO_MENU)

  await ctx.reply(lines.join('\n'), replyKeyboard(buttons))
}
