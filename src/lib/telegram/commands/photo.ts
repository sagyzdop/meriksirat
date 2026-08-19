/**
 * Telegram Photo Handler
 *
 * Handles photo messages for equipment return flow.
 */

import type { BotContext } from '../context'
import { getSession } from '../kv-session'
import { db } from '@/db'
import { bookingItem } from '@/db/schema'
import { inArray } from 'drizzle-orm'
import { logReturnPhotoToChannel } from '../logging'
import { backToMenuMarkup } from '../menu'
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
 * 6. Log the return to the club channel as a single photo message
 *
 * @param ctx - Bot context with environment bindings
 */
export async function handlePhoto(ctx: BotContext): Promise<void> {
  try {
    if (
      !ctx.message ||
      !('photo' in ctx.message) ||
      !ctx.message.photo ||
      !ctx.chat
    ) {
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
      // updates the items, recomputes parent booking statuses, and updates the
      // Google Calendar events with the actual return time).
      const result = await returnBookingItems(database, selectedItemIds)

      // If nothing was updated the items were already returned (e.g. a
      // duplicate/re-sent photo racing the first one). The session TTL
      // handles cleanup — no explicit delete needed.
      if (result.updated.length === 0) {
        return
      }

      // Resolve the booking this return belongs to, for the channel log.
      const bookingRows = await database
        .select({ bookingId: bookingItem.bookingId })
        .from(bookingItem)
        .where(inArray(bookingItem.id, selectedItemIds))
        .limit(1)

      if (bookingRows.length === 0) {
        throw new Error('No item details found after update')
      }
      const bookingId = bookingRows[0].bookingId
      const itemCount = selectedItemIds.length

      // Log the return to the club channel as a single photo message: the
      // caption is the full "Returned" booking log.
      await logReturnPhotoToChannel({
        photoFileId,
        bookingId,
      })

      // Confirm in place by editing the "please send a photo" prompt, keeping
      // the conversation message-sparse.
      const confirmation = `✅ Return logged for ${itemCount} item(s).\n\nPhoto sent to the club channel.`
      if (session.photoPromptMessageId) {
        try {
          await ctx.telegram.editMessageText(
            chatId,
            session.photoPromptMessageId,
            confirmation,
            backToMenuMarkup()
          )
        } catch (editError) {
          console.error('Failed to edit photo prompt after return:', editError)
          await ctx.reply(confirmation)
        }
      } else {
        await ctx.reply(confirmation)
      }
    } catch (error) {
      console.error('Return processing error:', {
        chatId,
        itemIds: selectedItemIds,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      const errorText = '❌ Error processing return. Please try again.'
      if (session.photoPromptMessageId) {
        try {
          await ctx.telegram.editMessageText(
            chatId,
            session.photoPromptMessageId,
            errorText,
            backToMenuMarkup()
          )
        } catch (editError) {
          console.error('Failed to edit photo prompt after error:', editError)
          await ctx.reply(errorText)
        }
      } else {
        await ctx.reply(errorText)
      }

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
