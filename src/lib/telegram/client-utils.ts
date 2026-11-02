/**
 * Client-safe Telegram utilities
 *
 * This module provides telegram-related utilities that can be safely used
 * on the client side without importing server-side modules or environment variables.
 */

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
