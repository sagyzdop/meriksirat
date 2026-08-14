/**
 * Server-side Telegram utilities
 *
 * This module provides telegram-related utilities that require server-side
 * access to environment variables and database connections.
 *
 * WARNING: Do not import this module from client-side code!
 */

import { TelegramAPI } from './api'
import { env } from 'cloudflare:workers'
import { db } from '@/db'
import { booking, bookingItem, user, equipment } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ============================================================================
// KEYBOARD UTILITIES
// ============================================================================

/**
 * Builds an inline keyboard from a flat button list, 2 buttons per row.
 * Buttons are `{ text, callback_data }` objects.
 */
export function inlineKeyboard(
  buttons: Array<{ text: string; callback_data: string }>
) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }
  return { reply_markup: { inline_keyboard: rows } }
}

/**
 * Removes the persistent reply keyboard from the chat.
 */
export function removeKeyboard(options: any = {}) {
  return {
    ...options,
    reply_markup: { remove_keyboard: true },
  }
}

// ============================================================================
// TELEGRAM API UTILITIES
// ============================================================================

/**
 * Creates a Telegram instance for logging (without bot context)
 * Used in server functions where we don't have the bot context
 */
export function createTelegramForLogging(botToken: string): TelegramAPI {
  return new TelegramAPI(botToken)
}

/**
 * Checks if Telegram logging is configured
 */
export function isTelegramLoggingEnabled(): boolean {
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CLUB_CHANNEL_ID)
}

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

/**
 * Gets booking details with user and equipment information
 * Common query used across multiple functions
 * Returns the parent booking plus the list of equipment names for its items.
 */
export async function getBookingDetailsForLogging(bookingId: number) {
  const database = db(env.meriksirat_d1 as D1Database)

  const parent = await database
    .select({
      bookingId: booking.id,
      userId: booking.userId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      startedAt: booking.startedAt,
      notes: booking.userEventDetails,
      status: booking.status,
      userName: user.name,
      userFirstName: user.firstName,
      userLastName: user.lastName,
      userEmail: user.email,
      userTelegramUsername: user.telegramUsername,
    })
    .from(booking)
    .innerJoin(user, eq(booking.userId, user.id))
    .where(eq(booking.id, bookingId))
    .get()

  if (!parent) return null

  const items = await database
    .select({
      equipmentName: equipment.modelName,
      equipmentId: equipment.id,
      status: bookingItem.status,
    })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(eq(bookingItem.bookingId, bookingId))

  return {
    ...parent,
    equipmentNames: items.map((i) => i.equipmentName),
    equipmentName: items.map((i) => i.equipmentName).join(', '),
    itemStatuses: items.map((i) => i.status),
  }
}

// ============================================================================
// REMINDER UTILITIES
// ============================================================================

/**
 * Sends a booking reminder to a user via Telegram
 *
 * @param telegram - TelegramAPI instance
 * @param chatId - User's Telegram chat ID
 * @param bookingDetails - Booking information
 */
export async function sendBookingReminder(
  telegram: TelegramAPI,
  chatId: string,
  bookingDetails: {
    userName: string
    equipmentNames: string[]
    startTime: Date
    endTime: Date
    notes?: string | null
  }
): Promise<void> {
  const { userName, equipmentNames, startTime, endTime, notes } = bookingDetails

  const startTimeStr = startTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const endTimeStr = endTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const dateStr = startTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  let message = `⏰ *Booking Reminder*\n\n`
  message += `Hi ${userName}! Your booking starts in 15 minutes.\n\n`
  if (equipmentNames.length === 1) {
    message += `📦 *Equipment:* ${equipmentNames[0]}\n`
  } else {
    message += `📦 *Equipment (${equipmentNames.length}):*\n${equipmentNames.map((name) => `  • ${name}`).join('\n')}\n`
  }
  message += `📅 *Date:* ${dateStr}\n`
  message += `🕐 *Time:* ${startTimeStr} - ${endTimeStr}\n`

  if (notes) {
    message += `\n📝 *Notes:* ${notes}\n`
  }

  message += `\nPlease arrive on time to pick up your equipment. 🚀`

  await telegram.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
  })
}
