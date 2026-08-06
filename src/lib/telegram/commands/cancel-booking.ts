/**
 * Telegram Cancel Booking Command
 *
 * Handles /cancel_booking - per-item or per-booking (all items) cancellation
 * of upcoming/active bookings.
 *
 * Callback data format:
 * - cancel_item_<itemId>              : shows a confirmation prompt
 * - confirm_cancel_item_<itemId>      : performs the cancellation
 * - deny_cancel_item_<itemId>         : aborts the cancellation
 * - cancel_all_<bookingId>            : shows a confirmation prompt for a booking
 * - confirm_cancel_all_<bookingId>    : cancels all items of the booking
 * - deny_cancel_all_<bookingId>       : aborts the cancellation
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

interface CancellableBooking {
  id: number
  items: Array<{
    itemId: number
    equipmentName: string
  }>
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
 * Fetch the user's bookings that still have cancellable items
 * (items that are not yet returned or cancelled).
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
        inArray(bookingItem.status, [
          BOOKING_STATUS.BOOKED,
          BOOKING_STATUS.ACTIVE,
          BOOKING_STATUS.OVERDUE,
        ])
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
 * Cancel a set of booking items, mirroring the logic of the web cancelBookingFn
 * (recompute parent statuses, log activity, delete gcal events).
 */
async function cancelItems(
  ctx: BotContext,
  userId: string,
  itemIds: number[]
): Promise<{ ok: boolean; message: string }> {
  if (itemIds.length === 0) {
    return { ok: false, message: 'No cancellable items found.' }
  }

  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const items = await database
    .select({
      id: bookingItem.id,
      bookingId: bookingItem.bookingId,
      itemStatus: bookingItem.status,
      equipmentName: equipment.modelName,
      googleCalendarEventId: bookingItem.googleCalendarEventId,
      equipmentCalendarId: equipment.googleCalendarId,
    })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
    .where(and(inArray(bookingItem.id, itemIds), eq(booking.userId, userId)))

  if (items.length === 0) {
    return { ok: false, message: 'Item not found.' }
  }

  const cancellable = items.filter(
    (it) => it.itemStatus !== 'cancelled' && it.itemStatus !== 'returned'
  )

  if (cancellable.length === 0) {
    return {
      ok: false,
      message: 'The selected items are already cancelled or returned.',
    }
  }

  await database
    .update(bookingItem)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(inArray(bookingItem.id, cancellable.map((it) => it.id)))

  const touchedBookings = new Set(cancellable.map((it) => it.bookingId))

  for (const bookingId of touchedBookings) {
    try {
      await recomputeBookingStatus(database, bookingId)
    } catch (err) {
      console.error(`Failed to recompute status for booking ${bookingId}:`, err)
    }
  }

  for (const bookingId of touchedBookings) {
    try {
      await logBookingActivityById(bookingId, 'cancelled', {
        previousStatus: items.find((it) => it.bookingId === bookingId)?.itemStatus,
        newStatus: 'cancelled',
      })
    } catch (logError) {
      console.error('Failed to log item cancellation:', logError)
    }
  }

  for (const it of cancellable) {
    if (it.googleCalendarEventId && it.equipmentCalendarId) {
      try {
        await deleteCalendarEvent({
          data: {
            equipmentCalendarId: it.equipmentCalendarId,
            eventId: it.googleCalendarEventId,
          },
        })
      } catch (err) {
        console.error('Failed to delete calendar event for cancelled item:', err)
      }
    }
  }

  const names = cancellable.map((it) => it.equipmentName).join(', ')
  const bookingsStr = [...touchedBookings]
    .sort((a, b) => a - b)
    .map((b) => `#${b}`)
    .join(', ')

  return {
    ok: true,
    message: `Cancelled ${names} (booking ${bookingsStr}).`,
  }
}

/**
 * Cancel all cancellable items of a single booking.
 */
async function cancelAllItems(
  ctx: BotContext,
  userId: string,
  bookingId: number
): Promise<{ ok: boolean; message: string }> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const rows = await database
    .select({ itemId: bookingItem.id })
    .from(bookingItem)
    .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
    .where(
      and(
        eq(bookingItem.bookingId, bookingId),
        eq(booking.userId, userId),
        inArray(bookingItem.status, [
          BOOKING_STATUS.BOOKED,
          BOOKING_STATUS.ACTIVE,
          BOOKING_STATUS.OVERDUE,
        ])
      )
    )

  return cancelItems(
    ctx,
    userId,
    rows.map((r) => r.itemId)
  )
}

/**
 * Handles the /cancel_booking command
 *
 * Flow:
 * 1. Verify user is linked to Telegram account
 * 2. Fetch bookings with cancellable items
 * 3. Show the bookings/items with inline cancel buttons
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

    const bookings = await fetchCancellableBookings(ctx, userId)

    if (bookings.length === 0) {
      await ctx.reply(
        'You have no upcoming or active bookings to cancel.',
        withKeyboard()
      )
      return
    }

    const buttons: Array<{ text: string; callback_data: string }> = []
    const messageLines: string[] = ['Select the item(s) you want to cancel:']

    for (const b of bookings) {
      messageLines.push(`\nBooking #${b.id}`)
      for (const it of b.items) {
        messageLines.push(`  • ${it.equipmentName}`)
      }
      for (const it of b.items) {
        buttons.push({
          text: it.equipmentName,
          callback_data: `cancel_item_${it.itemId}`,
        })
      }
      buttons.push({
        text: `Cancel all items (${b.items.length})`,
        callback_data: `cancel_all_${b.id}`,
      })
    }

    await ctx.reply(messageLines.join('\n'), buildInlineKeyboard(buttons))
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

  if (callbackData.startsWith('cancel_all_')) {
    const bookingId = parseInt(callbackData.substring('cancel_all_'.length), 10)
    if (isNaN(bookingId)) {
      await ctx.answerCbQuery('Invalid selection')
      return true
    }

    await ctx.editMessageText(
      `Cancel all items in booking #${bookingId}?`,
      buildInlineKeyboard([
        { text: 'Yes, cancel all', callback_data: `confirm_cancel_all_${bookingId}` },
        { text: 'No', callback_data: `deny_cancel_all_${bookingId}` },
      ])
    )
    await ctx.answerCbQuery()
    return true
  }

  if (
    callbackData.startsWith('confirm_cancel_item_') ||
    callbackData.startsWith('confirm_cancel_all_')
  ) {
    const isAll = callbackData.startsWith('confirm_cancel_all_')
    const prefix = isAll ? 'confirm_cancel_all_' : 'confirm_cancel_item_'
    const id = parseInt(callbackData.substring(prefix.length), 10)
    if (isNaN(id)) {
      await ctx.answerCbQuery('Invalid selection')
      return true
    }

    const userId = await getUserIdByChatId(ctx, chatId)

    if (!userId) {
      await ctx.answerCbQuery('Account not linked')
      return true
    }

    const result = isAll
      ? await cancelAllItems(ctx, userId, id)
      : await cancelItems(ctx, userId, [id])

    await ctx.editMessageText(result.message)
    await ctx.answerCbQuery()
    return true
  }

  if (
    callbackData.startsWith('deny_cancel_item_') ||
    callbackData.startsWith('deny_cancel_all_')
  ) {
    await ctx.editMessageText('Cancellation aborted.')
    await ctx.answerCbQuery()
    return true
  }

  return false
}
