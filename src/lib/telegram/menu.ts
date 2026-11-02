/**
 * Telegram Main Menu
 *
 * The bot is driven by a persistent reply keyboard with four actions. Tapping
 * a button sends its label as a plain text message, which the webhook text
 * router dispatches. Real notifications (reminders, auto-cancel, overdue,
 * admin alerts) are sent as separate messages.
 */

import type { BotContext } from './context'
import { replyKeyboard } from './server-utils'

export const MENU_TEXT = '📋 Main Menu\n\nChoose an action below:'

export const MAIN_MENU_BUTTONS = [
  '📋 My Bookings',
  '▶️ Start Booking',
  '↩️ Return Equipment',
  '❌ Cancel Booking',
]

export function mainMenuMarkup() {
  return replyKeyboard(MAIN_MENU_BUTTONS)
}

export const BACK_TO_MENU = '🏠 Main Menu'

export function backToMenuMarkup() {
  return replyKeyboard([BACK_TO_MENU])
}

/**
 * Shows the main menu (sends the menu text with the main reply keyboard).
 */
export async function showMainMenu(ctx: BotContext): Promise<void> {
  await ctx.reply(MENU_TEXT, mainMenuMarkup())
}
