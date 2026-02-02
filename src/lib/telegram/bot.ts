import { Telegraf, Context } from 'telegraf'
import { message } from 'telegraf/filters'
import { env } from 'cloudflare:workers'
import { handleStart } from './commands/start'
import { handleEndBooking } from './commands/end-booking'
import { handleCallback } from './commands/callback'
import { handlePhoto } from './commands/photo'

/**
 * Extended Telegraf context with Cloudflare environment bindings
 * Provides access to D1 database, KV storage, and environment variables
 */
export interface BotContext extends Context {
  env: typeof env
}

/**
 * Creates and configures a Telegraf bot instance with all handlers
 * 
 * @param envBindings - Cloudflare environment bindings (D1, KV, env vars)
 * @returns Configured Telegraf bot instance ready to handle updates
 * 
 * @example
 * ```typescript
 * import { env } from 'cloudflare:workers'
 * const bot = createBot(env)
 * await bot.handleUpdate(telegramUpdate)
 * ```
 */
export function createBot(envBindings: typeof env): Telegraf<BotContext> {
  // Initialize Telegraf with bot token from environment
  // webhookReply: false ensures we handle responses manually for better control
  const bot = new Telegraf<BotContext>(envBindings.TELEGRAM_BOT_TOKEN, {
    telegram: { webhookReply: false }
  })
  
  // Attach environment bindings to bot context for handler access
  // This middleware runs before all handlers, making env available via ctx.env
  bot.use((ctx, next) => {
    ctx.env = envBindings
    return next()
  })
  
  // Register command handlers
  bot.command('start', handleStart)
  bot.command('end_booking', handleEndBooking)
  
  // Register callback query handler
  bot.on('callback_query', handleCallback)
  
  // Register photo handler
  bot.on(message('photo'), handlePhoto)
  
  return bot
}
