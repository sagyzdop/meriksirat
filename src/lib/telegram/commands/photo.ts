/**
 * Telegram Photo Handler
 * 
 * Handles photo messages for equipment return flow.
 */

import { Context } from 'telegraf'
import { env } from 'cloudflare:workers'
import { getSession, deleteSession } from '../kv-session'
import { db } from '@/db'
import { booking, user, equipment } from '@/db/schema'
import { inArray, eq } from 'drizzle-orm'
import { notifyAdmins } from '../admin'
import { logBookingActivity } from '../logging'

/**
 * Extended Telegraf context with Cloudflare environment bindings
 */
interface BotContext extends Context {
  env: typeof env
}

/**
 * Handles photo messages for equipment return flow
 * 
 * Flow:
 * 1. Extract chat ID and photo file_id from the message
 * 2. Retrieve session from KV storage
 * 3. Validate session exists and step is 'awaiting_photo'
 * 4. If validation fails, ignore photo silently
 * 5. Extract selected booking IDs from session
 * 6. (Further processing in task 5.2 and 5.3)
 * 
 * @param ctx - Telegraf bot context with environment bindings
 * 
 * @example
 * User sends: [photo]
 * Bot processes: Updates bookings, notifies admins, confirms to user
 */
export async function handlePhoto(ctx: BotContext): Promise<void> {
  try {
    // Ensure we have a message with photo and chat
    if (!ctx.message || !('photo' in ctx.message) || !ctx.message.photo || !ctx.chat) {
      return
    }
    
    // Extract chat ID from Telegram context
    const chatId = String(ctx.chat.id)
    
    // Extract photo file_id (use largest size: last element in array)
    const photoArray = ctx.message.photo
    if (photoArray.length === 0) {
      return
    }
    const photoFileId = photoArray[photoArray.length - 1].file_id
    
    // Retrieve session from KV storage
    const session = await getSession(ctx.env.meriksirat_kv, chatId)
    
    // If no session or step is not 'awaiting_photo', ignore photo silently
    if (!session || session.step !== 'awaiting_photo') {
      return
    }
    
    // Extract selected booking IDs from session
    const selectedBookingIds = session.selectedBookingIds
    
    // Validate we have selected booking IDs
    if (!selectedBookingIds || selectedBookingIds.length === 0) {
      return
    }
    
    // Task 5.2: Process return and update database
    try {
      // Initialize database connection
      const database = db(ctx.env.meriksirat_d1 as D1Database)
      
      // Update booking status to 'returned' with current timestamp
      await database
        .update(booking)
        .set({ 
          status: 'returned',
          updatedAt: new Date()
        })
        .where(inArray(booking.id, selectedBookingIds))
      
      // Query booking details with user and equipment relations for notification
      const bookingDetails = await database
        .select({
          bookingId: booking.id,
          userName: user.name,
          equipmentName: equipment.modelName,
        })
        .from(booking)
        .innerJoin(user, eq(booking.userId, user.id))
        .innerJoin(equipment, eq(booking.equipmentId, equipment.id))
        .where(inArray(booking.id, selectedBookingIds))
      
      // Validate we got booking details
      if (bookingDetails.length === 0) {
        throw new Error('No booking details found after update')
      }
      
      // Build notification data
      const userName = bookingDetails[0].userName
      
      // Deduplicate equipment names using Set
      const uniqueEquipmentNames = [...new Set(bookingDetails.map(b => b.equipmentName))]
      const equipmentNames = uniqueEquipmentNames.join(', ')
      
      const itemCount = selectedBookingIds.length
      
      // Task 5.3: Send notifications and cleanup
      
      // Send notifications to all admins
      await notifyAdmins(
        ctx.env.meriksirat_d1,
        {
          photoFileId,
          userName,
          equipmentNames,
          itemCount,
        },
        ctx.telegram
      )
      
      // Log booking return to Telegram channel
      try {
        if (ctx.env.TELEGRAM_CLUB_CHANNEL_ID) {
          await logBookingActivity(ctx.telegram, ctx.env.TELEGRAM_CLUB_CHANNEL_ID, {
            bookingId: selectedBookingIds[0], // Use first booking ID for the log
            userId: session.userId!,
            userName,
            equipmentName: equipmentNames,
            action: 'returned',
            newStatus: 'returned'
          })
        }
      } catch (logError) {
        console.error('Failed to log booking return:', logError)
        // Don't fail the return if logging fails
      }
      
      // Reply with confirmation message to user
      await ctx.reply(`Return logged for ${itemCount} item(s). Summary sent to admins.`)
      
      // Delete session after successful completion
      await deleteSession(ctx.env.meriksirat_kv, chatId)
      
    } catch (error) {
      // Log error with context for debugging
      console.error('Return processing error:', {
        chatId,
        bookingIds: selectedBookingIds,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      
      // Send error message to user
      await ctx.reply('❌ Error processing return. Please try again.')
      
      // Preserve session for retry (don't delete)
      return
    }
    
  } catch (error) {
    // Log error with context for debugging
    console.error('Photo handler error:', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    
    // Note: We don't send error messages for photos without valid sessions
    // Only send error if we had a valid session but processing failed
    // This will be implemented in task 5.3
  }
}
