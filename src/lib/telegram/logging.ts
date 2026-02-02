/**
 * Telegram Logging
 * 
 * Handles logging booking activities to Telegram channels for audit and notification purposes.
 */

import { Telegram } from 'telegraf'
import { env } from 'cloudflare:workers'
import type { BookingLogData } from './types'
import { 
  createTelegramForLogging, 
  isTelegramLoggingEnabled, 
  getBookingDetailsForLogging 
} from './server-utils'

const ACTION_EMOJIS = {
  created: '📅',
  updated: '✏️',
  cancelled: '❌',
  returned: '✅'
} as const

function formatBookingLogMessage(data: BookingLogData): string {
  const { action, bookingId, userName, equipmentName, startTime, endTime, notes, previousStatus, newStatus } = data
  
  const emoji = ACTION_EMOJIS[action]
  const actionText = action.charAt(0).toUpperCase() + action.slice(1)
  
  let message = `${emoji} **Booking ${actionText}**\n\n`
  message += `📋 **Booking ID:** #${bookingId}\n`
  message += `👤 **User:** ${userName}\n`
  message += `🔧 **Equipment:** ${equipmentName}\n`
  
  if (startTime && endTime) {
    message += `📅 **Period:** ${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()} - ${endTime.toLocaleDateString()} ${endTime.toLocaleTimeString()}\n`
  }
  
  if (action === 'updated' && previousStatus && newStatus) {
    message += `🔄 **Status:** ${previousStatus} → ${newStatus}\n`
  } else if (newStatus) {
    message += `📊 **Status:** ${newStatus}\n`
  }
  
  if (notes) {
    message += `📝 **Notes:** ${notes}\n`
  }
  
  message += `\n⏰ ${new Date().toLocaleString()}`
  
  return message
}

/**
 * Sends a booking activity log to the Telegram channel
 * 
 * @param telegram - Telegraf Telegram API instance
 * @param channelId - Telegram channel ID (from TELEGRAM_CLUB_CHANNEL_ID)
 * @param logData - Booking activity data
 */
export async function logBookingActivity(
  telegram: Telegram,
  channelId: string,
  logData: BookingLogData
): Promise<void> {
  try {
    if (!channelId) {
      console.warn('TELEGRAM_CLUB_CHANNEL_ID not configured, skipping booking log')
      return
    }
    
    const message = formatBookingLogMessage(logData)
    
    await telegram.sendMessage(channelId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    } as any)
    
    console.log(`Booking activity logged to channel: ${logData.action} for booking #${logData.bookingId}`)
  } catch (error) {
    console.error('Failed to log booking activity to Telegram channel:', {
      bookingId: logData.bookingId,
      action: logData.action,
      error: error instanceof Error ? error.message : String(error)
    })
    // Don't throw - logging failures shouldn't break the main flow
  }
}

/**
 * High-level function to log booking activity with automatic data fetching
 * Reduces repetitive code in booking operations
 */
export async function logBookingActivityById(
  bookingId: number,
  action: BookingLogData['action'],
  options: {
    previousStatus?: string
    newStatus?: string
    notes?: string
  } = {}
): Promise<void> {
  try {
    if (!isTelegramLoggingEnabled()) {
      return
    }

    const bookingDetails = await getBookingDetailsForLogging(bookingId)
    if (!bookingDetails) {
      console.warn(`Booking ${bookingId} not found for logging`)
      return
    }

    const telegram = createTelegramForLogging(env.TELEGRAM_BOT_TOKEN!)
    
    await logBookingActivity(telegram, env.TELEGRAM_CLUB_CHANNEL_ID!, {
      bookingId: bookingDetails.bookingId,
      userId: bookingDetails.userId,
      userName: bookingDetails.userName || bookingDetails.userEmail,
      equipmentName: bookingDetails.equipmentName,
      action,
      startTime: bookingDetails.startTime,
      endTime: bookingDetails.endTime,
      notes: options.notes || bookingDetails.notes,
      previousStatus: options.previousStatus,
      newStatus: options.newStatus || bookingDetails.status
    })
  } catch (error) {
    console.error('Failed to log booking activity by ID:', {
      bookingId,
      action,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Logs a booking status change to the Telegram channel
 * 
 * @param bookingId - The booking ID
 * @param previousStatus - The previous status
 * @param newStatus - The new status
 * @param action - The action type (defaults to 'updated')
 */
export async function logBookingStatusChange(
  bookingId: number,
  previousStatus: string,
  newStatus: string,
  action: 'updated' | 'returned' = 'updated'
): Promise<void> {
  await logBookingActivityById(bookingId, action, {
    previousStatus,
    newStatus
  })
}

/**
 * Logs multiple booking status changes (useful for batch operations)
 */
export async function logMultipleBookingStatusChanges(
  changes: Array<{
    bookingId: number
    previousStatus: string
    newStatus: string
    action?: 'updated' | 'returned'
  }>
): Promise<void> {
  // Log each change individually to avoid overwhelming the channel
  for (const change of changes) {
    await logBookingStatusChange(
      change.bookingId,
      change.previousStatus,
      change.newStatus,
      change.action
    )
    
    // Small delay between messages to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}