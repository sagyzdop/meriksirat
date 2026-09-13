/**
 * Telegram Text Flow Router
 *
 * Routing table for reply-keyboard interactions. Every flow step in the KV
 * session maps to a handler here; the button labels users tap arrive as plain
 * text messages. Scheduled notifications never route here - they send ordinary
 * messages.
 */

import type { BotContext } from '../context'
import { getSession, setSession } from '../kv-session'
import { replyKeyboard } from '../server-utils'
import { showMainMenu, backToMenuButton, backToMenuMarkup } from '../menu'
import { renderStartConfirm, startBookingForChat } from './start-booking'
import {
  renderEndBookingList,
  renderReturnItemSelection,
  getReturnableItemsForBooking,
} from './end-booking'
import {
  renderCancelBookingList,
  renderCancelBookingItems,
  getCancellableItemsForBooking,
  cancelItems,
  getUserIdByChatId,
} from './cancel-booking'

const CONFIRM_BUTTON = '✅ Confirm'
const CANCEL_BUTTON = 'Cancel'
const BACK_TO_BOOKINGS = '⬅️ Back to bookings'

function parseBookingNumber(text: string): number | null {
  const match = text.match(/Booking #(\d+)/)
  if (!match) return null
  const id = parseInt(match[1], 10)
  return Number.isNaN(id) ? null : id
}

function confirmMarkup() {
  return replyKeyboard([CONFIRM_BUTTON, CANCEL_BUTTON, backToMenuButton()])
}

/**
 * Dispatches an incoming text message according to the session flow step.
 * Commands and menu labels are handled in the webhook route before this.
 */
export async function handleFlowText(ctx: BotContext): Promise<void> {
  const chatId = String(ctx.chat?.id)
  if (!ctx.message || !chatId || !('text' in ctx.message)) return
  const text = (ctx.message.text || '').trim()

  const session = await getSession(ctx.env.meriksirat_kv, chatId)
  if (!session || !session.step) {
    await showMainMenu(ctx)
    return
  }

  const userId = session.userId || (await getUserIdByChatId(ctx, chatId))

  switch (session.step) {
    case 'awaiting_start_selection':
    case 'awaiting_booking_selection':
    case 'awaiting_cancel_selection': {
      const bookingId = parseBookingNumber(text)
      if (!bookingId) {
        await ctx.reply('Please tap one of the buttons above.')
        return
      }

      if (session.step === 'awaiting_start_selection') {
        await setSession(ctx.env.meriksirat_kv, chatId, {
          ...session,
          step: 'awaiting_start_confirm',
          startBookingId: bookingId,
        })
        await renderStartConfirm(ctx, bookingId)
      } else if (session.step === 'awaiting_booking_selection') {
        await setSession(ctx.env.meriksirat_kv, chatId, {
          ...session,
          step: 'awaiting_item_selection',
          selectedBookingIds: [bookingId],
        })
        await renderReturnItemSelection(ctx, bookingId)
      } else {
        await setSession(ctx.env.meriksirat_kv, chatId, {
          ...session,
          step: 'awaiting_cancel_items',
          cancelBookingId: bookingId,
        })
        await renderCancelBookingItems(ctx, bookingId)
      }
      return
    }

    case 'awaiting_start_confirm': {
      if (!userId) {
        await showMainMenu(ctx)
        return
      }

      if (text === CONFIRM_BUTTON) {
        const bookingId = session.startBookingId
        if (!bookingId) {
          await showMainMenu(ctx)
          return
        }
        await startBookingForChat(ctx, bookingId)
      } else if (text === CANCEL_BUTTON) {
        await ctx.reply('Start cancelled.', backToMenuMarkup())
      } else {
        await ctx.reply('Send Confirm or Cancel.')
      }
      return
    }

    case 'awaiting_item_selection': {
      if (!userId) {
        await showMainMenu(ctx)
        return
      }

      const bookingId = session.selectedBookingIds?.[0]
      if (!bookingId) {
        await renderEndBookingList(ctx)
        return
      }

      const items = await getReturnableItemsForBooking(ctx, userId, bookingId)
      let itemIds: number[] = []

      if (text === 'Return All Items') {
        itemIds = items.map((it) => it.itemId)
      } else {
        const index = parseInt(text, 10)
        if (Number.isInteger(index) && index >= 1 && index <= items.length) {
          itemIds = [items[index - 1].itemId]
        }
      }

      if (itemIds.length === 0) {
        await ctx.reply('Please tap one of the buttons above.')
        return
      }

      await setSession(ctx.env.meriksirat_kv, chatId, {
        ...session,
        step: 'awaiting_photo',
        selectedItemIds: itemIds,
      })
      await ctx.reply('Send a photo of the equipment.', backToMenuMarkup())
      return
    }

    case 'awaiting_cancel_items': {
      if (!userId) {
        await showMainMenu(ctx)
        return
      }

      const bookingId = session.cancelBookingId
      if (!bookingId) {
        await renderCancelBookingList(ctx)
        return
      }

      if (text === BACK_TO_BOOKINGS) {
        await setSession(ctx.env.meriksirat_kv, chatId, {
          ...session,
          step: 'awaiting_cancel_selection',
          cancelBookingId: undefined,
        })
        await renderCancelBookingList(ctx)
        return
      }

      const items = await getCancellableItemsForBooking(ctx, userId, bookingId)
      let itemIds: number[] = []
      let label = ''

      if (text.startsWith('Cancel All Items')) {
        itemIds = items.map((it) => it.itemId)
        label = `all items in booking #${bookingId}`
      } else {
        const index = parseInt(text, 10)
        if (Number.isInteger(index) && index >= 1 && index <= items.length) {
          itemIds = [items[index - 1].itemId]
          label = `"${items[index - 1].equipmentName}"`
        }
      }

      if (itemIds.length === 0) {
        await ctx.reply('Please tap one of the buttons above.')
        return
      }

      await setSession(ctx.env.meriksirat_kv, chatId, {
        ...session,
        step: 'awaiting_cancel_confirm',
        pendingCancelItemIds: itemIds,
      })
      await ctx.reply(`Cancel ${label}?`, confirmMarkup())
      return
    }

    case 'awaiting_cancel_confirm': {
      if (!userId) {
        await showMainMenu(ctx)
        return
      }

      if (text === CONFIRM_BUTTON) {
        const ids = session.pendingCancelItemIds || []
        if (ids.length === 0) {
          await renderCancelBookingList(ctx)
          return
        }
        const result = await cancelItems(ctx, userId, ids)
        await ctx.reply(result.message, backToMenuMarkup())
      } else if (text === CANCEL_BUTTON) {
        if (session.cancelBookingId) {
          await setSession(ctx.env.meriksirat_kv, chatId, {
            ...session,
            step: 'awaiting_cancel_items',
            pendingCancelItemIds: undefined,
          })
          await renderCancelBookingItems(ctx, session.cancelBookingId)
        } else {
          await renderCancelBookingList(ctx)
        }
      } else {
        await ctx.reply('Send Confirm or Cancel.')
      }
      return
    }

    default:
      await showMainMenu(ctx)
  }
}
