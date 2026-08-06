/**
 * Client-safe Telegram utilities
 * 
 * This module provides telegram-related utilities that can be safely used
 * on the client side without importing server-side modules or environment variables.
 */

import { BOOKING_STATUS, type BookingStatus } from './types'

// ============================================================================
// CLIENT-SAFE UTILITIES
// ============================================================================

/**
 * Creates a simple Telegram bot link that opens the chat with the bot
 * User can then manually send /return_equipment command
 * 
 * @param botUsername - The Telegram bot username (without @)
 * @returns URL that opens Telegram chat with the bot
 */
export function createTelegramBotLink(botUsername: string): string {
  return `https://t.me/${botUsername}`
}

/**
 * Checks if a booking can be returned via Telegram
 * 
 * @param status - The booking status
 * @returns true if the booking can be returned
 */
export function canReturnBooking(status: string): boolean {
  return status === BOOKING_STATUS.ACTIVE
}

/**
 * Gets the display text for the return button based on booking status
 * 
 * @param status - The booking status
 * @returns Display text for the return button
 */
export function getReturnButtonText(status: string): string {
  switch (status) {
    case BOOKING_STATUS.ACTIVE:
      return 'Return via Telegram'
    default:
      return 'Return Equipment'
  }
}

// Re-export types and constants for convenience
export { BOOKING_STATUS, type BookingStatus } from './types'