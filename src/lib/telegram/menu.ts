/**
 * Telegram Main Menu
 *
 * The bot is driven by an inline-button main menu. Every action updates the
 * menu message in place via editMessageText instead of spamming new messages.
 * Only real notifications (reminders, auto-cancel, overdue, admin alerts) are
 * sent as separate messages.
 */

import type { BotContext } from './context'
import { inlineKeyboard } from './server-utils'

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
 * or by sending a new message (plain text command context).
 *
 * NOTE: a message must be sent with its inline keyboard in a single
 * sendMessage call. Telegram only allows editing messages sent without a
 * reply markup or with an inline keyboard; a message sent with
 * remove_keyboard cannot be edited afterwards ("message can't be edited").
 */
export async function renderInPlace(
  ctx: BotContext,
  text: string,
  markup?: Record<string, unknown>
): Promise<void> {
  const replyMarkup = markup?.reply_markup as
    Record<string, unknown> | undefined
  const isRemoveKeyboard = replyMarkup?.remove_keyboard === true

  if (isCallback(ctx)) {
    // Editing a tapped message: a remove_keyboard markup is meaningless here.
    await ctx.editMessageText(text, isRemoveKeyboard ? undefined : markup)
    return
  }

  await ctx.reply(text, markup)
}

/**
 * Shows the main menu. In a callback context it edits the tapped message in
 * place; otherwise it sends a new menu message and clears the old persistent
 * reply keyboard.
 */
export async function showMainMenu(ctx: BotContext): Promise<void> {
  await renderInPlace(ctx, MENU_TEXT, mainMenuMarkup())
}
