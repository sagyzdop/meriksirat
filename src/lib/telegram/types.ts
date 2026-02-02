/**
 * Telegram Types and Constants
 * 
 * Shared types and constants used across telegram functionality.
 * This file is safe for both client and server-side imports.
 */

/**
 * Booking status constants
 */
export const BOOKING_STATUS = {
  BOOKED: 'booked',
  ACTIVE: 'active',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue'
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
  action: 'created' | 'updated' | 'cancelled' | 'returned'
  startTime?: Date
  endTime?: Date
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
  step?: 'awaiting_item_selection' | 'awaiting_photo'
  userId?: string
  activeBookingIds?: number[]
  selectedBookingIds?: number[]
  createdAt?: number
}