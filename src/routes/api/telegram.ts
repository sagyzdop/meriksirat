/**
 * Telegram Webhook Route Handler
 * 
 * This route receives webhook updates from Telegram and processes them manually.
 * We use native fetch() instead of Telegraf's HTTP client which doesn't work in Cloudflare Workers.
 * 
 * Security:
 * - Verifies webhook secret token from x-telegram-bot-api-secret-token header
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { createFileRoute } from '@tanstack/react-router'
import type { Update } from '@/lib/telegram/types'
import { TelegramAPI } from '@/lib/telegram/api'
import { handleStart } from '@/lib/telegram/commands/start'
import { handleEndBooking } from '@/lib/telegram/commands/end-booking'
import { handleCallback } from '@/lib/telegram/commands/callback'
import { handlePhoto } from '@/lib/telegram/commands/photo'

export const Route = createFileRoute('/api/telegram')({
  server: {
    handlers: {
      async POST({ request }) {
        try {
          // Import env dynamically
          const { env } = await import('cloudflare:workers')
          
          // Verify webhook secret token
          const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')
          
          if (env.TELEGRAM_WEBHOOK_SECRET && headerSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
            console.warn('Unauthorized webhook attempt')
            return new Response('Unauthorized', { status: 401 })
          }

          // Parse Telegram update
          const update = await request.json() as Update
          
          console.log('Received update:', {
            updateId: update.update_id,
            type: Object.keys(update).filter(k => k !== 'update_id')[0]
          })
          
          // Create Telegram API client
          const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)
          
          // Create a simple context object
          const ctx: any = {
            update,
            env,
            telegram,
            reply: async (text: string, extra?: any) => {
              if ('message' in update && update.message) {
                return await telegram.sendMessage(update.message.chat.id, text, extra)
              }
              if ('callback_query' in update && update.callback_query?.message) {
                return await telegram.sendMessage(update.callback_query.message.chat.id, text, extra)
              }
            },
            answerCbQuery: async (text?: string) => {
              if ('callback_query' in update && update.callback_query) {
                return await telegram.answerCallbackQuery(update.callback_query.id, text)
              }
            },
            editMessageText: async (text: string, extra?: any) => {
              if ('callback_query' in update && update.callback_query?.message) {
                return await telegram.editMessageText(
                  update.callback_query.message.chat.id,
                  update.callback_query.message.message_id,
                  text,
                  extra
                )
              }
            }
          }
          
          // Add update-specific properties to context
          if ('message' in update && update.message) {
            ctx.message = update.message
            ctx.chat = update.message.chat
            ctx.from = update.message.from
          } else if ('callback_query' in update && update.callback_query) {
            ctx.callbackQuery = update.callback_query
            ctx.chat = update.callback_query.message?.chat
            ctx.from = update.callback_query.from
          }
          
          // Route to appropriate handler
          if ('message' in update && update.message && 'text' in update.message) {
            const text = update.message.text
            
            if (text && text.startsWith('/start')) {
              await handleStart(ctx)
            } else if (text && text.startsWith('/end_booking')) {
              await handleEndBooking(ctx)
            }
          } else if ('callback_query' in update) {
            await handleCallback(ctx)
          } else if ('message' in update && update.message && 'photo' in update.message) {
            await handlePhoto(ctx)
          }
          
          return new Response('OK', { status: 200 })
        } catch (error) {
          console.error('Webhook error:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          
          return new Response('Internal Server Error', { status: 500 })
        }
      },
    },
  },
})
