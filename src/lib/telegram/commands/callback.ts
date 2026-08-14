/**
 * Telegram Callback Query Handler
 *
 * Handles inline keyboard button clicks. The bot is menu-driven: main menu
 * callbacks (menu / menu_*) are handled first and render in place, then the
 * start-booking flow, then the return flow.
 *
 * Callback data format:
 * - menu                          : show the main menu
 * - menu_bookings / menu_start / menu_end / menu_cancel : sub-lists
 * - start_<bookingId>             : confirms a booking to start
 * - start_confirm_<bookingId>     : performs the start
 * - start_cancel                  : aborts the start
 * - book_<bookingId>              : selects a booking (return flow)
 * - item_<itemId>                 : selects a specific item (return flow)
 * - item_all_<bookingId>          : selects all returnable items of a booking
 * - cancel_book_<bookingId>       : selects a booking (cancel flow)
 * - cancel_book_list              : back to the cancel booking list
 * - cancel_item_<itemId>          : confirms a specific item (cancel flow)
 * - cancel_all_<bookingId>        : confirms all items of a booking (cancel flow)
 * - deny_cancel_<bookingId>       : aborts a cancel and re-shows the items
 */

import type { BotContext } from '../context'
import { getSession, setSession, deleteSession } from '../kv-session'
import { inlineKeyboard } from '../server-utils'
import { showMainMenu, backToMenuButton, backToMenuMarkup } from '../menu'
import { handleCancelCallback, renderCancelBookingList } from './cancel-booking'
import { startBookingForChat, renderStartBookingList } from './start-booking'
import { renderEndBookingList } from './end-booking'
import { renderMyBookings } from './list-bookings'
import { db } from '@/db'
import { bookingItem, booking, equipment } from '@/db/schema'
import { eq, and, inArray, notInArray } from 'drizzle-orm'
import { BOOKING_STATUS } from '../types'

/**
 * Shows a confirmation prompt for starting a booking.
 */
async function promptStartConfirm(
  ctx: BotContext,
  bookingId: number
): Promise<void> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const parent = await database
    .select({
      startTime: booking.startTime,
      endTime: booking.endTime,
    })
    .from(booking)
    .where(eq(booking.id, bookingId))
    .get()

  if (!parent) {
    await ctx.answerCbQuery('Booking not found')
    return
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

  const timeStart = parent.startTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const timeEnd = parent.endTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const equipmentLabel = items.map((i) => i.equipmentName).join(', ')

  await ctx.editMessageText(
    `Start booking #${bookingId} now?\n\n📦 Equipment: ${equipmentLabel}\n🕐 Time: ${timeStart} - ${timeEnd}`,
    inlineKeyboard([
      { text: '✅ Start Booking', callback_data: `start_confirm_${bookingId}` },
      { text: 'Cancel', callback_data: 'start_cancel' },
    ])
  )
  await ctx.answerCbQuery()
}

/**
 * Shows the item selection for a booking during the return flow.
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
          BOOKING_STATUS.ACTIVE,
          BOOKING_STATUS.OVERDUE,
        ])
      )
    )
    .orderBy(bookingItem.id)

  if (items.length === 0) {
    await ctx.answerCbQuery('No items to return')
    await renderEndBookingList(ctx)
    return
  }

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
  buttons.push(backToMenuButton())

  await ctx.editMessageText(
    `Select which items to return for booking #${bookingId}:`,
    inlineKeyboard(buttons)
  )
  await ctx.answerCbQuery()
}

/**
 * Handles inline keyboard button clicks (callback queries)
 */
export async function handleCallback(ctx: BotContext): Promise<void> {
  try {
    if (
      !ctx.callbackQuery ||
      !('data' in ctx.callbackQuery) ||
      !ctx.callbackQuery.message
    ) {
      return
    }

    const chatId = String(ctx.callbackQuery.message.chat.id)
    const callbackData = ctx.callbackQuery.data

    if (!callbackData) {
      await ctx.answerCbQuery('Invalid selection')
      return
    }

    // Main menu actions always take precedence, regardless of session state.
    if (callbackData === 'menu') {
      await deleteSession(ctx.env.meriksirat_kv, chatId)
      await showMainMenu(ctx)
      await ctx.answerCbQuery()
      return
    }

    if (callbackData === 'menu_bookings') {
      await deleteSession(ctx.env.meriksirat_kv, chatId)
      await renderMyBookings(ctx)
      await ctx.answerCbQuery()
      return
    }

    if (callbackData === 'menu_start') {
      await deleteSession(ctx.env.meriksirat_kv, chatId)
      await renderStartBookingList(ctx)
      await ctx.answerCbQuery()
      return
    }

    if (callbackData === 'menu_end') {
      await deleteSession(ctx.env.meriksirat_kv, chatId)
      await renderEndBookingList(ctx)
      await ctx.answerCbQuery()
      return
    }

    if (callbackData === 'menu_cancel') {
      await deleteSession(ctx.env.meriksirat_kv, chatId)
      await renderCancelBookingList(ctx)
      await ctx.answerCbQuery()
      return
    }

    // Cancel booking flow handles its own callbacks without a session
    if (await handleCancelCallback(ctx)) {
      return
    }

    const session = await getSession(ctx.env.meriksirat_kv, chatId)

    if (!session) {
      await ctx.answerCbQuery('Session expired')
      await showMainMenu(ctx)
      return
    }

    // Start booking flow
    if (
      session.step === 'awaiting_start_selection' &&
      callbackData.startsWith('start_')
    ) {
      const bookingIdStr = callbackData.substring('start_'.length)
      const bookingId = parseInt(bookingIdStr, 10)

      if (isNaN(bookingId)) {
        await ctx.answerCbQuery('Invalid selection')
        return
      }

      await setSession(ctx.env.meriksirat_kv, chatId, {
        ...session,
        startBookingId: bookingId,
        step: 'awaiting_start_confirm',
      })

      await promptStartConfirm(ctx, bookingId)
      return
    }

    if (session.step === 'awaiting_start_confirm') {
      if (callbackData.startsWith('start_confirm_')) {
        const bookingIdStr = callbackData.substring('start_confirm_'.length)
        const bookingId = parseInt(bookingIdStr, 10)

        if (isNaN(bookingId) || bookingId !== session.startBookingId) {
          await ctx.answerCbQuery('Invalid selection')
          return
        }

        // Answer the callback query right away: Telegram expires callback
        // queries after a few seconds, and starting a booking performs slow
        // database + calendar work. Answering late makes answerCbQuery throw,
        // which previously surfaced a misleading "Error processing selection"
        // even though the booking was started successfully.
        await ctx.answerCbQuery('Starting booking...')

        try {
          await startBookingForChat(bookingId, ctx)
          await ctx.editMessageText(
            `✅ Booking #${bookingId} has been started.\n\nThe equipment is now marked as picked up. Return it via the End Booking flow when done.`,
            backToMenuMarkup()
          )
          await deleteSession(ctx.env.meriksirat_kv, chatId)
        } catch (error) {
          console.error('Failed to start booking:', error)
          try {
            await ctx.editMessageText(
              error instanceof Error
                ? error.message
                : 'Failed to start booking. Please try again.',
              backToMenuMarkup()
            )
          } catch (editError) {
            console.error(
              'Failed to edit message after start booking error:',
              editError
            )
          }
        }
        return
      }

      if (callbackData === 'start_cancel') {
        await ctx.editMessageText('Start cancelled.', backToMenuMarkup())
        await ctx.answerCbQuery()
        await deleteSession(ctx.env.meriksirat_kv, chatId)
        return
      }

      await ctx.answerCbQuery('Invalid selection')
      return
    }

    // Step 1: awaiting_booking_selection -> select a booking, then prompt items
    if (
      session.step === 'awaiting_booking_selection' &&
      callbackData.startsWith('book_')
    ) {
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

      if (
        callbackData ===
        'item_all_' + (session.selectedBookingIds?.[0] ?? 'x')
      ) {
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
        photoPromptMessageId: ctx.callbackQuery.message.message_id,
      })

      await ctx.editMessageText(
        'Selected. Please send a photo of the equipment.',
        inlineKeyboard([{ text: '🔁 Cancel', callback_data: 'menu' }])
      )
      await ctx.answerCbQuery()
      return
    }

    await ctx.answerCbQuery('Invalid selection')
  } catch (error) {
    console.error('Callback query handler error:', {
      chatId: ctx.callbackQuery?.message?.chat.id,
      callbackData:
        ctx.callbackQuery && 'data' in ctx.callbackQuery
          ? ctx.callbackQuery.data
          : undefined,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    try {
      await ctx.answerCbQuery('Error processing selection')
    } catch (answerError) {
      console.error('Failed to answer callback query:', answerError)
    }

    await ctx.reply('Error processing selection. Please try again.')
  }
}
