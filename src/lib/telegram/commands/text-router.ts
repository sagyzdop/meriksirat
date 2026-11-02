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
import { getLinkedUserId, replyKeyboard } from '../server-utils'
import { showMainMenu, BACK_TO_MENU, backToMenuMarkup } from '../menu'
import { fetchBookingItems } from '../booking-queries'
import { handleStart } from './start'
import { handlePhoto } from './photo'
import {
  renderStartBookingList,
  renderStartConfirm,
  startBookingForChat,
} from './start-booking'
import { renderMyBookings } from './list-bookings'
import {
  renderEndBookingList,
  renderReturnItemSelection,
  RETURNABLE_STATUSES,
} from './end-booking'
import {
  renderCancelBookingList,
  renderCancelBookingItems,
  cancelItems,
  CANCELLABLE_STATUSES,
} from './cancel-booking'

type Handler = (ctx: BotContext) => Promise<void>

function guarded(label: string, render: Handler): Handler {
  return async (ctx) => {
    try {
      if (!ctx.message || !ctx.chat) return
      await render(ctx)
    } catch (error) {
      console.error(`${label} command error:`, {
        chatId: ctx.chat?.id,
        username: ctx.from?.username,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      await ctx.reply('Error fetching bookings. Please try again.')
    }
  }
}

const startBooking = guarded('Start booking', renderStartBookingList)
const endBooking = guarded('Return equipment', renderEndBookingList)
const listBookings = guarded('List bookings', renderMyBookings)
const cancelBooking = guarded('Cancel booking', renderCancelBookingList)

const COMMANDS: Array<[string, Handler]> = [
  ['/start_booking', startBooking],
  ['/return_equipment', endBooking],
  ['/my_bookings', listBookings],
  ['/cancel_booking', cancelBooking],
  ['/start', handleStart],
]

const BUTTONS = new Map<string, Handler>([
  ['📋 My Bookings', listBookings],
  ['My Bookings', listBookings],
  ['▶️ Start Booking', startBooking],
  ['Start Booking', startBooking],
  ['↩️ Return Equipment', endBooking],
  ['End Booking', endBooking],
  ['❌ Cancel Booking', cancelBooking],
  ['Cancel Booking', cancelBooking],
  [BACK_TO_MENU, showMainMenu],
])

export async function routeMessage(ctx: BotContext): Promise<void> {
  const message = ctx.message
  if (!message) return

  if ('photo' in message) {
    await handlePhoto(ctx)
    return
  }
  if (!('text' in message)) return

  const text = (message.text || '').trim()
  const handler =
    COMMANDS.find(([prefix]) => text.startsWith(prefix))?.[1] ??
    BUTTONS.get(text) ??
    handleFlowText
  await handler(ctx)
}

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
  return replyKeyboard([CONFIRM_BUTTON, CANCEL_BUTTON, BACK_TO_MENU])
}

/**
 * Dispatches an incoming text message according to the session flow step.
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

  const userId = await getLinkedUserId(ctx, chatId)

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
        if (!userId) {
          await showMainMenu(ctx)
          return
        }
        const found = await renderStartConfirm(ctx, userId, bookingId)
        if (found) {
          await setSession(ctx.env.meriksirat_kv, chatId, {
            ...session,
            step: 'awaiting_start_confirm',
            startBookingId: bookingId,
          })
        }
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
        await startBookingForChat(ctx, userId, bookingId)
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

      const items = await fetchBookingItems(
        ctx,
        userId,
        bookingId,
        RETURNABLE_STATUSES
      )
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

      const items = await fetchBookingItems(
        ctx,
        userId,
        bookingId,
        CANCELLABLE_STATUSES
      )
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
