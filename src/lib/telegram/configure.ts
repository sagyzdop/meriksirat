/**
 * Telegram Bot Configuration
 *
 * Run periodically (from the scheduled handler) to keep the bot's global
 * configuration in sync.
 *
 * The ☰ menu button is Telegram's standard UI for bots and cannot be removed
 * via the API (setChatMenuButton always reports type "commands"), so instead
 * we keep a single useful /start command that opens the inline main menu.
 */

import { TelegramAPI } from './api'

export async function configureTelegramBot(env: {
  TELEGRAM_BOT_TOKEN?: string
}): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return

  const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)

  await telegram.setMyCommands([
    { command: 'start', description: 'Open the main menu' },
  ])
  await telegram.setChatMenuButton({ type: 'default' })
}
