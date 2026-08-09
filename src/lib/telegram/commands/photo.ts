/**
 * Telegram Photo Handler
 * 
 * Handles photo messages for equipment return flow.
 */

import type { BotContext } from '../context'
import { getSession, deleteSession } from '../kv-session'
import { db } from '@/db'
import { bookingItem, booking, equipment, user } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { notifyAdmins } from '../admin'
import { logBookingActivity } from '../logging'
import { withKeyboard } from '../server-utils'
import { returnBookingItems } from '@/lib/booking/booking-items'

/**
 * Handles photo messages for equipment return flow
 * 
 * Flow:
 * 1. Extract chat ID and photo file_id from the message
 * 2. Retrieve session from KV storage
 * 3. Validate session exists and step is 'awaiting_photo'
 * 4. Mark the selected booking items as returned
 * 5. Recompute parent booking statuses
 * 6. Notify admins and log the return
 *
 * @param ctx - Bot context with environment bindings
 */
export async function handlePhoto(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.message || !('photo' in ctx.message) || !ctx.message.photo || !ctx.chat) {
      return
    }

    const chatId = String(ctx.chat.id)

    const photoArray = ctx.message.photo
    if (photoArray.length === 0) {
      return
    }
    const photoFileId = photoArray[photoArray.length - 1].file_id

    const session = await getSession(ctx.env.meriksirat_kv, chatId)

    if (!session || session.step !== 'awaiting_photo') {
      return
    }

    const selectedItemIds = session.selectedItemIds

    if (!selectedItemIds || selectedItemIds.length === 0) {
      return
    }

    try {
      const database = db(ctx.env.meriksirat_d1 as D1Database)

      // Mark selected items as returned (reuses the shared return logic:
      // updates the items, recomputes parent booking statuses, deletes the
      // Google Calendar events for the returned items).
      await returnBookingItems(database, selectedItemIds)

      // Query returned item details with equipment and user for notification
      const itemDetails = await database
        .select({
          equipmentName: equipment.modelName,
          bookingId: bookingItem.bookingId,
          userFirstName: user.firstName,
          userLastName: user.lastName,
        })
        .from(bookingItem)
        .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
        .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
        .innerJoin(user, eq(booking.userId, user.id))
        .where(inArray(bookingItem.id, selectedItemIds))

      if (itemDetails.length === 0) {
        throw new Error('No item details found after update')
      }

      const userName = [itemDetails[0].userFirstName, itemDetails[0].userLastName].filter(Boolean).join(' ') || 'Unknown User'

      const uniqueEquipmentNames = [...new Set(itemDetails.map((b) => b.equipmentName))]
      const equipmentNames = uniqueEquipmentNames.join(', ')
      const itemCount = selectedItemIds.length

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
            bookingId: itemDetails[0].bookingId,
            userId: session.userId!,
            userName,
            equipmentName: equipmentNames,
            equipmentNames: uniqueEquipmentNames,
            action: 'returned',
            newStatus: 'returned'
          })
        }
      } catch (logError) {
        console.error('Failed to log booking return:', logError)
      }

      await ctx.reply(
        `Return logged for ${itemCount} item(s). Summary sent to admins.`,
        withKeyboard()
      )

      await deleteSession(ctx.env.meriksirat_kv, chatId)

    } catch (error) {
      console.error('Return processing error:', {
        chatId,
        itemIds: selectedItemIds,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      await ctx.reply(
        '❌ Error processing return. Please try again.',
        withKeyboard()
      )

      return
    }

  } catch (error) {
    console.error('Photo handler error:', {
      chatId: ctx.chat?.id,
      username: ctx.from?.username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
}
