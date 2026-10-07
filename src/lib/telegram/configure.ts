/**
 * Telegram Bot Configuration
 *
 * Run periodically (from the scheduled handler) to keep the bot's command
 * list in sync. The ☰ menu button is managed via BotFather — the API cannot
 * remove it, only swap it for a commands or web_app button, so it is
 * deliberately not touched here.
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
}
