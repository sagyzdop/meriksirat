/**
 * Server-side Telegram utilities
 * 
 * This module provides telegram-related utilities that require server-side
 * access to environment variables and database connections.
 * 
 * WARNING: Do not import this module from client-side code!
 */

import { Telegram } from 'telegraf'
import { env } from 'cloudflare:workers'
import { db } from '@/db'
import { booking, user, equipment } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ============================================================================
// TELEGRAM API UTILITIES
// ============================================================================

/**
 * Creates a Telegram instance for logging (without bot context)
 * Used in server functions where we don't have the bot context
 */
export function createTelegramForLogging(botToken: string): Telegram {
  return new Telegram(botToken)
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
      userEmail: user.email,
      equipmentName: equipment.modelName,
      equipmentId: equipment.id
    })
    .from(booking)
    .innerJoin(user, eq(booking.userId, user.id))
    .innerJoin(equipment, eq(booking.equipmentId, equipment.id))
    .where(eq(booking.id, bookingId))
    .get()
}