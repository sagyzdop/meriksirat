/**
 * Telegram Main Menu
 *
 * The bot is driven by an inline-button main menu. Every action updates the
 * menu message in place via editMessageText instead of spamming new messages.
 * Only real notifications (reminders, auto-cancel, overdue, admin alerts) are
 * sent as separate messages.
 */

import type { BotContext } from './context'
import { inlineKeyboard, removeKeyboard } from './server-utils'

export const MENU_TEXT = '📋 Main Menu\n\nChoose an action below:'

export function mainMenuMarkup() {
  return inlineKeyboard([
    { text: '📋 My Bookings', callback_data: 'menu_bookings' },
    { text: '▶️ Start Booking', callback_data: 'menu_start' },
    { text: '↩️ End Booking', callback_data: 'menu_end' },
    { text: '❌ Cancel Booking', callback_data: 'menu_cancel' },
  ])
}

export function backToMenuButton() {
  return { text: '🏠 Main Menu', callback_data: 'menu' }
}

export function backToMenuMarkup() {
  return inlineKeyboard([backToMenuButton()])
}

/**
 * True when the context was produced by an inline button tap.
 */
export function isCallback(ctx: BotContext): boolean {
  return !!ctx.callbackQuery && 'data' in ctx.callbackQuery
}

/**
 * Renders a flow step either by editing the tapped message (callback context)
 * or by sending a new message (plain text command context). New messages with
 * inline buttons first remove the old persistent reply keyboard, then attach
 * the buttons via an edit.
 */
export async function renderInPlace(
  ctx: BotContext,
  text: string,
  markup?: any
): Promise<void> {
  // Editing the tapped message: a remove_keyboard markup makes no sense here.
  const effectiveMarkup = markup?.reply_markup?.remove_keyboard
    ? undefined
    : markup

  if (isCallback(ctx)) {
    await ctx.editMessageText(text, effectiveMarkup)
    return
  }

  const chatId = ctx.chat?.id
  if (chatId === undefined || chatId === null) return

  const hasInlineKeyboard = !!effectiveMarkup?.reply_markup?.inline_keyboard

  if (hasInlineKeyboard) {
    const sent = await ctx.reply(text, removeKeyboard())
    if (sent?.message_id) {
      await ctx.telegram.editMessageText(
        chatId,
        sent.message_id,
        text,
        effectiveMarkup
      )
    }
  } else {
    await ctx.reply(text, effectiveMarkup)
  }
}

/**
 * Shows the main menu. In a callback context it edits the tapped message in
 * place; otherwise it sends a new menu message and clears the old persistent
 * reply keyboard.
 */
export async function showMainMenu(ctx: BotContext): Promise<void> {
  await renderInPlace(ctx, MENU_TEXT, mainMenuMarkup())
}
