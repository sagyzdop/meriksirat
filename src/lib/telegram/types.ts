/**
 * Telegram Types and Constants
 * 
 * Shared types and constants used across telegram functionality.
 * This file is safe for both client and server-side imports.
 */

// ============================================================================
// TELEGRAM BOT API TYPES
// Based on https://core.telegram.org/bots/api
// ============================================================================

export interface Update {
  update_id: number
  message?: Message
  callback_query?: CallbackQuery
}

export interface Message {
  message_id: number
  from?: User
  chat: Chat
  date: number
  text?: string
  photo?: PhotoSize[]
}

export interface CallbackQuery {
  id: string
  from: User
  message?: Message
  data?: string
}

export interface User {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
}

export interface Chat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface PhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

// ============================================================================
// APPLICATION TYPES
// ============================================================================

/**
 * Booking status constants
 */
export const BOOKING_STATUS = {
  BOOKED: 'booked',
  ACTIVE: 'active',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
  PARTIALLY_RETURNED: 'partially_returned'
} as const

export type BookingStatus = typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS]

/**
 * Booking log data structure for telegram logging
 */
export interface BookingLogData {
  bookingId: number
  userId: string
  userName: string
  equipmentName: string
  equipmentNames?: string[]
  action: 'created' | 'updated' | 'cancelled' | 'returned' | 'deleted'
  startTime?: Date
  endTime?: Date
  startedAt?: Date | null
  notes?: string | null
  previousStatus?: string
  newStatus?: string
}

/**
 * Admin notification data structure
 */
export interface AdminNotification {
  photoFileId: string
  userName: string
  equipmentNames: string  // Already deduplicated, comma-separated
  itemCount: number
}

/**
 * Session data structure for KV storage
 */
export interface SessionData {
  step?: 'awaiting_booking_selection' | 'awaiting_item_selection' | 'awaiting_photo' | 'awaiting_start_selection' | 'awaiting_start_confirm'
  userId?: string
  activeBookingIds?: number[]
  selectedBookingIds?: number[]
  selectedItemIds?: number[]
  startBookingId?: number
  createdAt?: number
}
