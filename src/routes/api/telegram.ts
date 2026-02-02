/**
 * Telegram Webhook Route Handler
 * 
 * This route receives webhook updates from Telegram and processes them using Telegraf.
 * 
 * Security:
 * - Verifies webhook secret token from x-telegram-bot-api-secret-token header
 * - Returns 401 Unauthorized if secret doesn't match env.TELEGRAM_WEBHOOK_SECRET
 * 
 * Processing:
 * - Creates Telegraf bot instance with environment bindings
 * - Delegates update handling to bot.handleUpdate()
 * - Returns 200 OK on success, 500 on error
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { createBot } from '@/lib/telegram/bot'
import type { Update } from 'telegraf/types'

export const Route = createFileRoute('/api/telegram')({
  server: {
    handlers: {
      async POST({ request }) {
        try {
          // Verify webhook secret token (Requirement 8.4)
          const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')
          
          if (env.TELEGRAM_WEBHOOK_SECRET && headerSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
            console.warn('Unauthorized webhook attempt', {
              receivedSecret: headerSecret ? '[REDACTED]' : 'none',
              timestamp: new Date().toISOString()
            })
            return new Response('Unauthorized', { status: 401 }) // Requirement 8.5
          }

          // Parse Telegram update from request body
          const update = await request.json() as Update
          
          // Create bot instance with environment bindings (Requirement 8.2)
          const bot = createBot(env)
          
          // Process update through Telegraf (Requirements 11.1-11.5)
          await bot.handleUpdate(update)
          
          // Return success response (Requirement 8.6)
          return new Response('OK', { status: 200 })
        } catch (error) {
          // Log error with context for debugging (Requirement 12.5)
          console.error('Webhook error:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          })
          
          // Return error response (Requirement 8.6)
          return new Response('Internal Server Error', { status: 500 })
        }
      },
    },
  },
})
