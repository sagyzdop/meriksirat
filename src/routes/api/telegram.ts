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
import type { BotContext } from '@/lib/telegram/context'
import { TelegramAPI } from '@/lib/telegram/api'
import { routeMessage } from '@/lib/telegram/commands/text-router'

export const Route = createFileRoute('/api/telegram')({
  server: {
    handlers: {
      async POST({ request }) {
        try {
          // Import env dynamically
          const { env } = await import('cloudflare:workers')

          // Verify webhook secret token. Fail closed: if the secret is not
          // configured, reject every webhook rather than accept unverified
          // updates that could trigger bot commands.
          const headerSecret = request.headers.get(
            'x-telegram-bot-api-secret-token'
          )

          if (!env.TELEGRAM_WEBHOOK_SECRET) {
            console.error(
              'TELEGRAM_WEBHOOK_SECRET is not configured; rejecting webhook'
            )
            return new Response('Misconfigured', { status: 500 })
          }

          if (headerSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
            console.warn('Unauthorized webhook attempt')
            return new Response('Unauthorized', { status: 401 })
          }

          // Parse Telegram update
          const update = (await request.json()) as Update

          // The bot only talks in private chats. Messages from groups or a
          // channel's direct-messages chat (where a reply needs a topic id)
          // are acknowledged and dropped, before any DB work.
          if (update.message && update.message.chat.type !== 'private') {
            return new Response('OK', { status: 200 })
          }

          // Rate limit per chat so a single spammy chat cannot churn the whole
          // webhook (every update triggers DB reads and possibly bot replies).
          // Keying on the chat id (not IP) is required because all webhooks
          // arrive from Telegram's own IPs.
          const chatId = update.message?.chat?.id

          if (chatId) {
            const { rateLimit } = await import('@/lib/ratelimit')
            const rl = await rateLimit(
              request.headers,
              'rl_telegram_webhook',
              `chat:${chatId}`
            )
            if (!rl.allowed) {
              console.warn(
                `Telegram update rate limit exceeded for chat ${chatId}`
              )
              return new Response('Too Many Requests', { status: 429 })
            }
          }

          // Create Telegram API client
          const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)

          const message = update.message
          const ctx: BotContext = {
            update,
            env,
            telegram,
            message,
            chat: message?.chat,
            from: message?.from,
            reply: async (text: string, extra?: Record<string, unknown>) => {
              if (message) {
                return await telegram.sendMessage(message.chat.id, text, extra)
              }
            },
          }

          await routeMessage(ctx)

          return new Response('OK', { status: 200 })
        } catch (error) {
          console.error('Webhook error:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          })

          return new Response('Internal Server Error', { status: 500 })
        }
      },
    },
  },
})
