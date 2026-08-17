/**
 * Custom Telegram Context
 *
 * Replaces Telegraf's Context with a simpler version that works in Cloudflare Workers
 */

import type { Update, Message, CallbackQuery, Chat, User } from './types'
import type { TelegramAPI } from './api'
import { env } from 'cloudflare:workers'

export interface BotContext {
  update: Update
  env: typeof env
  telegram: TelegramAPI
  message?: Message
  callbackQuery?: CallbackQuery
  chat?: Chat
  from?: User
  reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown>
  answerCbQuery: (text?: string) => Promise<unknown>
  editMessageText: (
    text: string,
    extra?: Record<string, unknown>
  ) => Promise<unknown>
}
