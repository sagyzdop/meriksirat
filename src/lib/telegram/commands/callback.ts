/**
 * Telegram Callback Query Handler
 * 
 * Handles inline keyboard button clicks during equipment return flow.
 */

import { Context } from 'telegraf'
import { env } from 'cloudflare:workers'
import { getSession, setSession } from '../kv-session'

/**
 * Extended Telegraf context with Cloudflare environment bindings
 */
interface BotContext extends Context {
  env: typeof env
}

/**
 * Handles inline keyboard button clicks (callback queries)
 * 
 * Flow:
 * 1. Extract chat ID and callback data from the callback query
 * 2. Retrieve session from KV storage
 * 3. Validate session exists and step is 'awaiting_item_selection'
 * 4. Parse callback data to determine selected booking IDs
 * 5. Update session with selected IDs and change step to 'awaiting_photo'
 * 6. Edit original message to confirm selection
 * 7. Answer callback query to remove loading state
 * 
 * @param ctx - Telegraf bot context with environment bindings
 * 
 * @example
 * User clicks: "Laptop" button (callback_data: "select_123")
 * Bot edits message: "Selected. Please send a photo of the equipment."
 */
export async function handleCallback(ctx: BotContext): Promise<void> {
  try {
    // Ensure we have a callback query with message and data
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery) || !ctx.callbackQuery.message) {
      return
    }
    
    // Extract chat ID from callback query message
    const chatId = String(ctx.callbackQuery.message.chat.id)
    
    // Extract callback data (button identifier)
    const callbackData = ctx.callbackQuery.data
    
    // Retrieve session from KV storage
    const session = await getSession(ctx.env.meriksirat_kv, chatId)
    
    // Validate session exists and is in correct state
    if (!session || session.step !== 'awaiting_item_selection') {
      await ctx.answerCbQuery('Session expired or invalid')
      await ctx.reply('Please use /end_booking first.')
      return
    }
    
    // Parse callback data to determine selected booking IDs
    let selectedBookingIds: number[]
    
    if (callbackData === 'select_all') {
      // User selected "Return All Items"
      selectedBookingIds = session.activeBookingIds || []
    } else if (callbackData.startsWith('select_')) {
      // User selected specific item: extract booking ID
      const bookingIdStr = callbackData.substring(7) // Remove "select_" prefix
      const bookingId = parseInt(bookingIdStr, 10)
      
      // Validate booking ID is a valid number
      if (isNaN(bookingId)) {
        await ctx.answerCbQuery('Invalid selection')
        return
      }
      
      selectedBookingIds = [bookingId]
    } else {
      // Invalid callback data format
      await ctx.answerCbQuery('Invalid selection')
      return
    }
    
    // Update session with selected booking IDs and change step to awaiting_photo
    await setSession(ctx.env.meriksirat_kv, chatId, {
      ...session,
      selectedBookingIds,
      step: 'awaiting_photo',
    })
    
    // Edit original message to confirm selection
    await ctx.editMessageText('Selected. Please send a photo of the equipment.')
    
    // Answer callback query to remove loading state from button
    await ctx.answerCbQuery()
    
  } catch (error) {
    // Log error with context for debugging
    console.error('Callback query handler error:', {
      chatId: ctx.callbackQuery?.message?.chat.id,
      callbackData: ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    
    // Try to answer callback query even on error
    try {
      await ctx.answerCbQuery('Error processing selection')
    } catch (answerError) {
      console.error('Failed to answer callback query:', answerError)
    }
    
    // Send user-friendly error message
    await ctx.reply('Error processing selection. Please try again.')
  }
}
