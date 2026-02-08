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
import { booking, user, equipment } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ============================================================================
// KEYBOARD UTILITIES
// ============================================================================

/**
 * Standard reply keyboard markup for the bot
 * Shows persistent keyboard with common commands
 */
export const STANDARD_KEYBOARD = {
  keyboard: [
    [{ text: '/end_booking' }],
  ],
  resize_keyboard: true,
  persistent: true,
  placeholder: 'Choose a command...'
} as const

/**
 * Creates reply options with the standard keyboard
 */
export function withKeyboard(options: any = {}) {
  return {
    ...options,
    reply_markup: STANDARD_KEYBOARD
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
 */
export async function getBookingDetailsForLogging(bookingId: number) {
  const database = db(env.meriksirat_d1 as D1Database)
  
  return await database
    .select({
      bookingId: booking.id,
      userId: booking.userId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      notes: booking.userEventDetails,
      status: booking.status,
      userName: user.name,
      userFirstName: user.firstName,
      userLastName: user.lastName,
      userEmail: user.email,
      userTelegramUsername: user.telegramUsername,
      equipmentName: equipment.modelName,
      equipmentId: equipment.id
    })
    .from(booking)
    .innerJoin(user, eq(booking.userId, user.id))
    .innerJoin(equipment, eq(booking.equipmentId, equipment.id))
    .where(eq(booking.id, bookingId))
    .get()
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
    equipmentName: string
    startTime: Date
    endTime: Date
    notes?: string | null
  }
): Promise<void> {
  const { userName, equipmentName, startTime, endTime, notes } = bookingDetails
  
  const startTimeStr = startTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  })
  const endTimeStr = endTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  })
  const dateStr = startTime.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric' 
  })

  let message = `⏰ *Booking Reminder*\n\n`
  message += `Hi ${userName}! Your booking starts in 15 minutes.\n\n`
  message += `📦 *Equipment:* ${equipmentName}\n`
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