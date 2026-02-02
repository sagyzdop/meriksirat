import { Context, Markup } from 'telegraf'
import { env } from 'cloudflare:workers'
import { db } from '@/db'
import { eq, and } from 'drizzle-orm'
import { user, booking, equipment } from '@/db/schema'
import { setSession } from '../kv-session'
import { BOOKING_STATUS } from '../types'

/**
 * Extended Telegraf context with Cloudflare environment bindings
 */
interface BotContext extends Context {
  env: typeof env
}

/**
 * Handles the /end_booking command to initiate equipment return flow
 * 
 * Flow:
 * 1. Verify user is linked to Telegram account
 * 2. Fetch active bookings (status: awaiting_pickup or pending_handover)
 * 3. If no bookings, inform user
 * 4. If bookings found, proceed to session creation (handled in task 3.2)
 * 
 * @param ctx - Telegraf bot context with environment bindings
 * 
 * @example
 * User sends: /end_booking
 * Bot responds: (keyboard with equipment list or photo prompt)
 */
export async function handleEndBooking(ctx: BotContext): Promise<void> {
  try {
    // Ensure we have a message and chat
    if (!ctx.message || !ctx.chat) {
      return
    }
    
    // Extract chat ID from Telegram context
    const chatId = String(ctx.chat.id)
    
    // Initialize database connection
    const database = db(ctx.env.meriksirat_d1 as D1Database)
    
    // Query for user by Telegram chat ID
    const userRecord = await database
      .select()
      .from(user)
      .where(eq(user.telegramChatId, chatId))
      .limit(1)
      .then(rows => rows[0])
    
    // If user not found, they need to link their account first
    if (!userRecord) {
      await ctx.reply('Please link your account via /start first.')
      return
    }
    
    // Query for active bookings with equipment relations
    // Active bookings are those with status 'active'
    const activeBookings = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        equipment: {
          id: equipment.id,
          modelName: equipment.modelName,
        },
      })
      .from(booking)
      .innerJoin(equipment, eq(booking.equipmentId, equipment.id))
      .where(
        and(
          eq(booking.userId, userRecord.id),
          eq(booking.status, BOOKING_STATUS.ACTIVE)
        )
      )
    
    // If no active bookings found, inform user
    if (activeBookings.length === 0) {
      await ctx.reply('You have no active bookings to return.')
      return
    }
    
    // Create session in KV with initial state
    const activeBookingIds = activeBookings.map(b => b.id)
    
    // If single booking: auto-select and skip to photo request
    if (activeBookings.length === 1) {
      await setSession(ctx.env.meriksirat_kv, chatId, {
        step: 'awaiting_photo',
        userId: userRecord.id,
        activeBookingIds,
        selectedBookingIds: [activeBookings[0].id],
        createdAt: Date.now(),
      })
      
      await ctx.reply('Please send a photo of the equipment to confirm its condition.')
      return
    }
    
    // Multiple bookings: create session and show inline keyboard
    await setSession(ctx.env.meriksirat_kv, chatId, {
      step: 'awaiting_item_selection',
      userId: userRecord.id,
      activeBookingIds,
      createdAt: Date.now(),
    })
    
    // Build inline keyboard with equipment model names
    const buttons = activeBookings.map(b => 
      Markup.button.callback(
        b.equipment.modelName,
        `select_${b.id}`
      )
    )
    
    // Add "Return All Items" button
    buttons.push(Markup.button.callback('Return All Items', 'select_all'))
    
    // Send keyboard message (2 buttons per row for better UX)
    await ctx.reply(
      'Select which items to return:',
      Markup.inlineKeyboard(buttons, { columns: 2 })
    )
    
  } catch (error) {
    // Log error with context for debugging
    console.error('End booking command error:', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    
    // Send user-friendly error message
    await ctx.reply('Error fetching bookings. Please try again.')
  }
}
