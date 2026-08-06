/**
 * Telegram Callback Query Handler
 * 
 * Handles inline keyboard button clicks during equipment return flow.
 * 
 * Callback data format:
 * - book_<bookingId>   : selects a booking (step: awaiting_booking_selection)
 * - item_<itemId>      : selects a specific item (step: awaiting_item_selection)
 * - item_all_<bookingId> : selects all returnable items of a booking
 */

import type { BotContext } from '../context'
import { getSession, setSession } from '../kv-session'
import { withKeyboard } from '../server-utils'
import { db } from '@/db'
import { bookingItem, equipment } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { BOOKING_STATUS } from '../types'

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
 * Fetches the returnable items for a booking and prompts the user to select.
 */
async function promptItemSelection(
  ctx: BotContext,
  chatId: string,
  userId: string,
  bookingId: number
): Promise<void> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const items = await database
    .select({
      itemId: bookingItem.id,
      equipmentName: equipment.modelName,
    })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(
        eq(bookingItem.bookingId, bookingId),
        inArray(bookingItem.status, [
          BOOKING_STATUS.BOOKED,
          BOOKING_STATUS.ACTIVE,
          BOOKING_STATUS.OVERDUE,
        ])
      )
    )
    .orderBy(bookingItem.id)

  await setSession(ctx.env.meriksirat_kv, chatId, {
    step: 'awaiting_item_selection',
    userId,
    activeBookingIds: [bookingId],
    selectedBookingIds: [bookingId],
    createdAt: Date.now(),
  })

  const buttons = items.map((it) => ({
    text: it.equipmentName,
    callback_data: `item_${it.itemId}`,
  }))
  buttons.push({
    text: 'Return All Items',
    callback_data: `item_all_${bookingId}`,
  })

  await ctx.editMessageText(
    `Select which items to return for booking #${bookingId}:`,
    buildInlineKeyboard(buttons)
  )
  await ctx.answerCbQuery()
}

/**
 * Handles inline keyboard button clicks (callback queries)
 */
export async function handleCallback(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery) || !ctx.callbackQuery.message) {
      return
    }

    const chatId = String(ctx.callbackQuery.message.chat.id)
    const callbackData = ctx.callbackQuery.data

    if (!callbackData) {
      await ctx.answerCbQuery('Invalid selection')
      return
    }

    const session = await getSession(ctx.env.meriksirat_kv, chatId)

    if (!session) {
      await ctx.answerCbQuery('Session expired or invalid')
      await ctx.reply('Please use /end_booking first.', withKeyboard())
      return
    }

    // Step 1: awaiting_booking_selection -> select a booking, then prompt items
    if (session.step === 'awaiting_booking_selection' && callbackData.startsWith('book_')) {
      const bookingIdStr = callbackData.substring(5)
      const bookingId = parseInt(bookingIdStr, 10)

      if (isNaN(bookingId)) {
        await ctx.answerCbQuery('Invalid selection')
        return
      }

      await promptItemSelection(ctx, chatId, session.userId!, bookingId)
      return
    }

    // Step 2: awaiting_item_selection -> select items, then request photo
    if (session.step === 'awaiting_item_selection') {
      let selectedItemIds: number[]

      if (callbackData === 'item_all_' + (session.selectedBookingIds?.[0] ?? 'x')) {
        // "Return All Items" - collect all returnable items for the booking
        const database = db(ctx.env.meriksirat_d1 as D1Database)
        const bookingId = session.selectedBookingIds![0]
        const items = await database
          .select({ itemId: bookingItem.id })
          .from(bookingItem)
          .where(
            and(
              eq(bookingItem.bookingId, bookingId),
              inArray(bookingItem.status, [
                BOOKING_STATUS.BOOKED,
                BOOKING_STATUS.ACTIVE,
                BOOKING_STATUS.OVERDUE,
              ])
            )
          )
        selectedItemIds = items.map((i) => i.itemId)
      } else if (callbackData.startsWith('item_')) {
        const itemIdStr = callbackData.substring(5)
        const itemId = parseInt(itemIdStr, 10)
        if (isNaN(itemId)) {
          await ctx.answerCbQuery('Invalid selection')
          return
        }
        selectedItemIds = [itemId]
      } else {
        await ctx.answerCbQuery('Invalid selection')
        return
      }

      if (selectedItemIds.length === 0) {
        await ctx.answerCbQuery('No items to return')
        return
      }

      await setSession(ctx.env.meriksirat_kv, chatId, {
        ...session,
        selectedItemIds,
        step: 'awaiting_photo',
      })

      await ctx.editMessageText('Selected. Please send a photo of the equipment.')
      await ctx.answerCbQuery()
      return
    }

    await ctx.answerCbQuery('Invalid selection')
  } catch (error) {
    console.error('Callback query handler error:', {
      chatId: ctx.callbackQuery?.message?.chat.id,
      callbackData: ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    try {
      await ctx.answerCbQuery('Error processing selection')
    } catch (answerError) {
      console.error('Failed to answer callback query:', answerError)
    }

    await ctx.reply('Error processing selection. Please try again.', withKeyboard())
  }
}
