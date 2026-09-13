/**
 * Telegram Bot Configuration
 *
 * Run periodically (from the scheduled handler) to keep the bot's global
 * configuration in sync.
 *
 * The ☰ menu button next to the input field cannot be removed via the API; for
 * all users it can only be set to a command list or a mini-app (web_app)
 * button. With the persistent reply keyboard as the main menu, the ☰ is
 * repurposed to launch the booking web app. /start remains available for
 * account linking.
 */

import { TelegramAPI } from './api'

const WEB_APP_URL = 'https://nuimg.sagyzdop.com'

export async function configureTelegramBot(env: {
  TELEGRAM_BOT_TOKEN?: string
  BETTER_AUTH_URL?: string
}): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return

  const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)

  await telegram.setMyCommands([
    { command: 'start', description: 'Open the main menu' },
  ])

  const appUrl =
    env.BETTER_AUTH_URL && !env.BETTER_AUTH_URL.includes('localhost')
      ? env.BETTER_AUTH_URL
      : WEB_APP_URL

  await telegram.setChatMenuButton({
    type: 'web_app',
    web_app: { url: appUrl },
  })
}
