/**
 * Telegram Bot Configuration
 *
 * Keeps the bot's command list in sync. It runs once per deploy: the hourly
 * cron compares the deployed Worker version id with a KV marker and only calls
 * Telegram when they differ. The ☰ menu button is managed via BotFather — the
 * API cannot remove it, only swap it for a commands or web_app button, so it
 * is deliberately not touched here.
 */

import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { TelegramAPI } from './api'

const DEPLOY_MARKER_KEY = 'telegram-bot:configured-version'

export async function configureTelegramBot(
  env: { TELEGRAM_BOT_TOKEN?: string },
  budget?: Budget
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return
  if (!takeIfBudgeted(budget, 1)) return

  const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)

  await telegram.setMyCommands([
    { command: 'start', description: 'Open the main menu' },
  ])
}

export async function configureTelegramBotOncePerDeploy(
  env: {
    meriksirat_kv: KVNamespace
    TELEGRAM_BOT_TOKEN?: string
    CF_VERSION_METADATA?: { id: string }
  },
  budget?: Budget
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return
  const version = env.CF_VERSION_METADATA?.id ?? 'unversioned'
  if ((await env.meriksirat_kv.get(DEPLOY_MARKER_KEY)) === version) return
  if (budget && !budget.canAfford(1)) return

  await configureTelegramBot(env, budget)
  await env.meriksirat_kv.put(DEPLOY_MARKER_KEY, version)
  console.log(`[cron] configured Telegram bot for version ${version}`)
}
