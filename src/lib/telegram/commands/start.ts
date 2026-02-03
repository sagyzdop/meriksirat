import type { BotContext } from '../context'
import { env } from 'cloudflare:workers'
import { db } from '@/db'
import { eq, and, gt } from 'drizzle-orm'
import { user, telegramToken } from '@/db/schema'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth/auth'
import { withKeyboard } from '../server-utils'

/**
 * Handles the /start command for Telegram account linking (deeplink flow)
 * 
 * Flow:
 * 1. Extract token from command args (/start {token})
 * 2. Validate token against database (check expiration)
 * 3. Link Telegram account to user account
 * 4. Delete used token
 * 5. Send confirmation message
 * 
 * @param ctx - Telegraf bot context with environment bindings
 * 
 * @example
 * User sends: /start abc123-def456-ghi789
 * Bot responds: "Telegram linked ✅"
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  try {
    console.log('/start command received', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      timestamp: new Date().toISOString()
    })
    
    // Ensure we have a message and chat
    if (!ctx.message || !ctx.chat) {
      console.warn('/start: Missing message or chat context')
      return
    }
    
    // Extract command args from message text
    // Format: /start {token} or just /start
    const messageText = ('text' in ctx.message ? ctx.message.text : '') || ''
    const args = messageText.split(' ')
    const token = args[1] // Token is the second element after /start
    
    console.log('/start: Parsed command', {
      messageText,
      hasToken: !!token,
      argsLength: args.length
    })
    
    // If no token provided, send welcome message with keyboard
    if (!token) {
      await ctx.reply(
        'Welcome! Please use the link from the web app to connect your account.',
        withKeyboard()
      )
      return
    }
    
    // Extract chat ID and username from Telegram context
    const chatId = String(ctx.chat.id)
    const username = ctx.from?.username
    
    // Initialize database connection
    const database = db(ctx.env.meriksirat_d1 as D1Database)
    
    // Query for valid, non-expired token
    const currentTime = new Date()
    const tokenRecord = await database
      .select()
      .from(telegramToken)
      .where(
        and(
          eq(telegramToken.token, token),
          gt(telegramToken.expiresAt, currentTime)
        )
      )
      .limit(1)
      .then(rows => rows[0])
    
    // If token is invalid or expired, send error message
    if (!tokenRecord) {
      await ctx.reply('Link expired or invalid.')
      return
    }
    
    // Update user with Telegram account information
    await database
      .update(user)
      .set({
        telegramChatId: chatId,
        telegramUsername: username,
        onboardingComplete: true,
      })
      .where(eq(user.id, tokenRecord.userId))
    
    // Delete the used token
    await database
      .delete(telegramToken)
      .where(eq(telegramToken.token, token))
    
    // Send success confirmation with persistent keyboard
    await ctx.reply(
      'Telegram linked ✅\n\nYou can now use the menu below to interact with the bot.',
      withKeyboard()
    )
    
  } catch (error) {
    // Log error with context for debugging
    console.error('Start command error:', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    
    // Send user-friendly error message
    await ctx.reply('Error linking account. Please try again.')
  }
}

/**
 * Generates a Telegram deep link URL for account linking
 * Creates a temporary token and returns the bot link with the token
 */
export const getTelegramLinkUrl = createServerFn({ method: 'POST' })
  .handler(async () => {
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    // Check if user already has Telegram linked
    const userData = await database
      .select({ telegramChatId: user.telegramChatId })
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()

    if (userData?.telegramChatId) {
      return { 
        alreadyLinked: true,
        url: null,
        token: null
      }
    }

    // Generate a unique token
    const token = crypto.randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store token in database
    await database.insert(telegramToken).values({
      token,
      userId: session.user.id,
      expiresAt,
    })

    // Get bot username from environment
    const botUsername = env.TELEGRAM_BOT_USERNAME || 'your_equipment_bot'
    
    // Create deep link URL
    const url = `https://t.me/${botUsername}?start=${token}`

    return {
      alreadyLinked: false,
      url,
      token
    }
  })
