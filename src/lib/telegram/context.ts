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
  reply: (text: string, extra?: any) => Promise<any>
  answerCbQuery: (text?: string) => Promise<any>
  editMessageText: (text: string, extra?: any) => Promise<any>
}
