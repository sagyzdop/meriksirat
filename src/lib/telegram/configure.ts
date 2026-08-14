/**
 * Telegram Bot Configuration
 *
 * Run periodically (from the scheduled handler) to keep the bot's global
 * configuration in sync. Currently clears the command menu so the bot is
 * driven purely by the inline-button interface.
 */

import { TelegramAPI } from './api'

export async function configureTelegramBot(env: any): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return

  const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)

  // The bot is button-driven: remove the command list (and therefore the
  // hamburger menu content) so users interact via the inline main menu.
  await telegram.setMyCommands([])
  await telegram.setChatMenuButton({ type: 'default' })
}
