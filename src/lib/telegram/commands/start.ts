import type { BotContext } from '../context'
import { env } from 'cloudflare:workers'
import { db } from '@/db'
import { eq, and, gt } from 'drizzle-orm'
import { user, telegramToken } from '@/db/schema'
import { removeKeyboard } from '../server-utils'
import { showMainMenu } from '../menu'

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

    // Extract chat ID and username from Telegram context
    const chatId = String(ctx.chat.id)
    const username = ctx.from?.username

    // If no token provided: linked users get the main menu, new users get the
    // welcome message (linking happens via the web app deep link /start <token>)
    if (!token) {
      const database = db(ctx.env.meriksirat_d1 as D1Database)
      const linkedUser = await database
        .select({ id: user.id })
        .from(user)
        .where(eq(user.telegramChatId, chatId))
        .limit(1)
        .then((rows) => rows[0])

      if (linkedUser) {
        await showMainMenu(ctx)
      } else {
        await ctx.reply(
          'Welcome! Please use the link from the web app to connect your account.',
          removeKeyboard()
        )
      }
      return
    }

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
      .then((rows) => rows[0])

    // If token is invalid or expired, send error message
    if (!tokenRecord) {
      // A re-tap of an already-used link: if this chat is already linked just
      // proceed to the menu instead of showing a scary error.
      const alreadyLinked = await database
        .select({ id: user.id })
        .from(user)
        .where(eq(user.telegramChatId, chatId))
        .limit(1)
        .then((rows) => rows[0])
      if (alreadyLinked) {
        await showMainMenu(ctx)
        return
      }
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
    await database.delete(telegramToken).where(eq(telegramToken.token, token))

    // Send success confirmation, then show the main menu
    await ctx.reply('Telegram linked ✅', removeKeyboard())
    await showMainMenu(ctx)
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
 * Creates a temporary Telegram deep-link token for the given user and returns
 * the bot link that carries it. Tapping the link sends /start <token>, which
 * links (or re-syncs) the user's Telegram chat with their account.
 *
 * This is a plain server-side helper (not a server function) so it can be
 * called directly from the onboarding server functions without an extra RPC
 * round-trip.
 */
export async function createTelegramLinkToken(userId: string): Promise<string> {
  const database = db(env.meriksirat_d1 as D1Database)

  // Reuse an existing unexpired token so page reloads / repeated onboarding
  // visits do not keep inserting new rows into D1.
  const existing = await database
    .select()
    .from(telegramToken)
    .where(
      and(
        eq(telegramToken.userId, userId),
        gt(telegramToken.expiresAt, new Date())
      )
    )
    .limit(1)
    .then((rows) => rows[0])

  const botUsername = env.TELEGRAM_BOT_USERNAME || 'your_equipment_bot'

  if (existing) {
    return `https://t.me/${botUsername}?start=${existing.token}`
  }

  // Generate a unique token
  const token = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Store token in database
  await database.insert(telegramToken).values({
    token,
    userId,
    expiresAt,
  })

  return `https://t.me/${botUsername}?start=${token}`
}
