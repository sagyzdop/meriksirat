/**
 * Telegram Cancel Booking Command
 *
 * Handles /cancel_booking - per-item cancellation of upcoming/active bookings.
 *
 * Callback data format:
 * - cancel_item_<itemId>           : shows a confirmation prompt
 * - confirm_cancel_item_<itemId>   : performs the cancellation
 * - deny_cancel_item_<itemId>      : aborts the cancellation
 */

import type { BotContext } from '../context'
import { db } from '@/db'
import { eq, and, inArray } from 'drizzle-orm'
import { user, booking, bookingItem, equipment } from '@/db/schema'
import { withKeyboard } from '../server-utils'
import { BOOKING_STATUS } from '../types'
import { recomputeBookingStatus } from '@/lib/booking/status'
import { logBookingActivityById } from '../logging'
import { deleteCalendarEvent } from '@/lib/google/google-caledar'

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

interface CancellableItem {
  itemId: number
  bookingId: number
  equipmentName: string
}

async function getUserIdByChatId(
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
 * Fetch the user's items that can still be cancelled
 * (items that are not yet returned or cancelled).
 */
async function fetchCancellableItems(
  ctx: BotContext,
  userId: string
): Promise<CancellableItem[]> {
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
        inArray(bookingItem.status, [
          BOOKING_STATUS.BOOKED,
          BOOKING_STATUS.ACTIVE,
          BOOKING_STATUS.OVERDUE,
        ])
      )
    )
    .orderBy(booking.startTime, bookingItem.id)

  return rows.map((r) => ({
    itemId: r.itemId,
    bookingId: r.bookingId,
    equipmentName: r.equipmentName,
  }))
}

/**
 * Cancel a single booking item, mirroring the per-item logic of the web
 * cancelBookingFn (recompute parent status, log activity, delete gcal event).
 */
async function cancelItem(
  ctx: BotContext,
  userId: string,
  itemId: number
): Promise<{ ok: boolean; message: string }> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const item = await database
    .select({
      bookingId: bookingItem.bookingId,
      itemStatus: bookingItem.status,
      equipmentName: equipment.modelName,
      googleCalendarEventId: bookingItem.googleCalendarEventId,
      equipmentCalendarId: equipment.googleCalendarId,
    })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
    .where(and(eq(bookingItem.id, itemId), eq(booking.userId, userId)))
    .limit(1)
    .then((rows) => rows[0])

  if (!item) {
    return { ok: false, message: 'Item not found.' }
  }

  if (
    item.itemStatus === 'cancelled' ||
    item.itemStatus === 'returned'
  ) {
    return { ok: false, message: 'This item is already cancelled or returned.' }
  }

  await database
    .update(bookingItem)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(bookingItem.id, itemId))

  await recomputeBookingStatus(database, item.bookingId)

  try {
    await logBookingActivityById(item.bookingId, 'cancelled', {
      previousStatus: item.itemStatus,
      newStatus: 'cancelled',
    })
  } catch (logError) {
    console.error('Failed to log item cancellation:', logError)
  }

  if (item.googleCalendarEventId && item.equipmentCalendarId) {
    try {
      await deleteCalendarEvent({
        data: {
          equipmentCalendarId: item.equipmentCalendarId,
          eventId: item.googleCalendarEventId,
        },
      })
    } catch (err) {
      console.error('Failed to delete calendar event for cancelled item:', err)
    }
  }

  return {
    ok: true,
    message: `Cancelled ${item.equipmentName} from booking #${item.bookingId}.`,
  }
}

/**
 * Handles the /cancel_booking command
 *
 * Flow:
 * 1. Verify user is linked to Telegram account
 * 2. Fetch cancellable items
 * 3. Show a list of items with inline cancel buttons
 *
 * @param ctx - Bot context with environment bindings
 */
export async function handleCancelBooking(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.message || !ctx.chat) {
      return
    }

    const chatId = String(ctx.chat.id)
    const userId = await getUserIdByChatId(ctx, chatId)

    if (!userId) {
      await ctx.reply(
        'Please link your account via /start first.',
        withKeyboard()
      )
      return
    }

    const items = await fetchCancellableItems(ctx, userId)

    if (items.length === 0) {
      await ctx.reply(
        'You have no upcoming or active bookings to cancel.',
        withKeyboard()
      )
      return
    }

    const buttons = items.map((it) => ({
      text: `#${it.bookingId} - ${it.equipmentName}`,
      callback_data: `cancel_item_${it.itemId}`,
    }))

    await ctx.reply(
      'Select the item you want to cancel:',
      buildInlineKeyboard(buttons)
    )
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

/**
 * Handles callback queries for the cancel flow.
 * Returns true when the callback data was handled by this module.
 */
export async function handleCancelCallback(ctx: BotContext): Promise<boolean> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery) || !ctx.callbackQuery.message) {
    return false
  }

  const callbackData = ctx.callbackQuery.data
  if (!callbackData) {
    return false
  }

  const chatId = String(ctx.callbackQuery.message.chat.id)

  if (callbackData.startsWith('cancel_item_')) {
    const itemId = parseInt(callbackData.substring('cancel_item_'.length), 10)
    if (isNaN(itemId)) {
      await ctx.answerCbQuery('Invalid selection')
      return true
    }

    await ctx.editMessageText(
      'Cancel this item?',
      buildInlineKeyboard([
        { text: 'Yes, cancel', callback_data: `confirm_cancel_item_${itemId}` },
        { text: 'No', callback_data: `deny_cancel_item_${itemId}` },
      ])
    )
    await ctx.answerCbQuery()
    return true
  }

  if (callbackData.startsWith('confirm_cancel_item_')) {
    const itemId = parseInt(
      callbackData.substring('confirm_cancel_item_'.length),
      10
    )
    if (isNaN(itemId)) {
      await ctx.answerCbQuery('Invalid selection')
      return true
    }

    const userId = await getUserIdByChatId(ctx, chatId)

    if (!userId) {
      await ctx.answerCbQuery('Account not linked')
      return true
    }

    const result = await cancelItem(ctx, userId, itemId)

    await ctx.editMessageText(result.message)
    await ctx.answerCbQuery()
    return true
  }

  if (callbackData.startsWith('deny_cancel_item_')) {
    await ctx.editMessageText('Cancellation aborted.')
    await ctx.answerCbQuery()
    return true
  }

  return false
}
