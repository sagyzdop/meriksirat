/**
 * Server-side Telegram utilities
 *
 * This module provides telegram-related utilities that require server-side
 * access to environment variables and database connections.
 *
 * WARNING: Do not import this module from client-side code!
 */

import { env } from 'cloudflare:workers'
import { db } from '@/db'
import { booking, bookingItem, user, equipment } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ============================================================================
// KEYBOARD UTILITIES
// ============================================================================

/**
 * Builds a persistent reply keyboard from button labels. Each label (or row
 * array) becomes a tappable button; tapping one sends its text as a message.
 */
export function replyKeyboard(buttons: string[] | string[][]) {
  const rows = Array.isArray(buttons[0])
    ? (buttons as string[][])
    : (buttons as string[]).map((label) => [label])
  return { reply_markup: { keyboard: rows, resize_keyboard: true } }
}

/**
 * Removes the persistent reply keyboard from the chat.
 */
export function removeKeyboard() {
  return { reply_markup: { remove_keyboard: true } }
}

// ============================================================================
// TELEGRAM API UTILITIES
// ============================================================================

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
    itemStatuses: items.map((i) => i.status),
  }
}
