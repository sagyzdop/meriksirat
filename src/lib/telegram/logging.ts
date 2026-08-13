/**
 * Telegram Logging
 *
 * Handles logging booking activities to Telegram channels for audit and notification purposes.
 */

import { TelegramAPI } from './api'
import { env } from 'cloudflare:workers'
import type { BookingLogData } from './types'
import {
  createTelegramForLogging,
  isTelegramLoggingEnabled,
  getBookingDetailsForLogging,
} from './server-utils'
import { formatUserDisplayName } from '@/lib/utils'

const ACTION_LABELS = {
  created: 'Created',
  updated: 'Updated',
  cancelled: 'Cancelled',
  returned: 'Returned',
  deleted: 'Deleted',
} as const

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

/**
 * Describes whether an action covered the whole booking or only some of its
 * items, based on the per-item statuses fetched after the action ran.
 */
function describeBookingScope(data: BookingLogData): string | null {
  const names = data.equipmentNames?.length
    ? data.equipmentNames
    : data.equipmentName
      ? [data.equipmentName]
      : []
  const statuses = data.itemStatuses
  if (!statuses || statuses.length === 0 || statuses.length !== names.length) {
    return null
  }

  const target = data.action === 'cancelled' ? 'cancelled' : 'returned'
  const affected = names
    .map((name, i) => ({ name, status: statuses[i] }))
    .filter((item) => item.status === target)

  if (affected.length === 0) return null
  if (affected.length === names.length) {
    return target === 'cancelled'
      ? 'Scope: Entire booking cancelled'
      : 'Scope: Entire booking returned'
  }

  return `Scope: ${affected.length} of ${names.length} ${
    names.length === 1 ? 'item' : 'items'
  } ${target} (${affected.map((item) => item.name).join(', ')})`
}

function formatBookingLogMessage(data: BookingLogData): string {
  const lines: string[] = [
    `Booking #${data.bookingId} · ${ACTION_LABELS[data.action]}`,
  ]

  lines.push(`User: ${data.userName}`)

  if (
    data.previousStatus &&
    data.newStatus &&
    data.previousStatus !== data.newStatus
  ) {
    lines.push(
      `Status: ${formatStatus(data.previousStatus)} → ${formatStatus(data.newStatus)}`
    )
  } else if (data.newStatus) {
    lines.push(`Status: ${formatStatus(data.newStatus)}`)
  }

  const scope = describeBookingScope(data)
  if (scope) {
    lines.push(scope)
  }

  const equipmentNames = data.equipmentNames?.length
    ? data.equipmentNames
    : data.equipmentName
      ? [data.equipmentName]
      : []
  if (equipmentNames.length > 0) {
    lines.push(`Equipment: ${equipmentNames.join(', ')}`)
  }

  if (data.startTime && data.endTime) {
    const date = data.startTime.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const timeStart = data.startTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const timeEnd = data.endTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    lines.push(`Booking Time: ${date}, ${timeStart} – ${timeEnd}`)
  }

  if (data.startedAt) {
    const started = data.startedAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    lines.push(`Started at: ${started}`)
  }

  if (data.notes) {
    lines.push(`Notes: ${data.notes}`)
  }

  return lines.join('\n')
}

/**
 * Sends a booking activity log to the Telegram channel
 *
 * @param telegram - Telegram API instance
 * @param channelId - Telegram channel ID (from TELEGRAM_CLUB_CHANNEL_ID)
 * @param logData - Booking activity data
 */
export async function logBookingActivity(
  telegram: TelegramAPI,
  channelId: string,
  logData: BookingLogData
): Promise<void> {
  try {
    if (!channelId) {
      console.warn(
        'TELEGRAM_CLUB_CHANNEL_ID not configured, skipping booking log'
      )
      return
    }

    const message = formatBookingLogMessage(logData)

    await telegram.sendMessage(channelId, message, {
      disable_web_page_preview: true,
    } as any)
  } catch (error) {
    console.error('Failed to log booking activity to Telegram channel:', {
      bookingId: logData.bookingId,
      action: logData.action,
      error: error instanceof Error ? error.message : String(error),
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

    const userName = formatUserDisplayName({
      firstName: bookingDetails.userFirstName,
      lastName: bookingDetails.userLastName,
      name: bookingDetails.userName,
      telegramUsername: bookingDetails.userTelegramUsername,
    })

    await logBookingActivity(telegram, env.TELEGRAM_CLUB_CHANNEL_ID!, {
      bookingId: bookingDetails.bookingId,
      userId: bookingDetails.userId,
      userName,
      equipmentName: bookingDetails.equipmentName,
      equipmentNames: bookingDetails.equipmentNames,
      itemStatuses: bookingDetails.itemStatuses,
      action,
      startTime: bookingDetails.startTime,
      endTime: bookingDetails.endTime,
      startedAt: bookingDetails.startedAt,
      notes: options.notes || bookingDetails.notes,
      previousStatus: options.previousStatus,
      newStatus: options.newStatus || bookingDetails.status,
    })
  } catch (error) {
    console.error('Failed to log booking activity by ID:', {
      bookingId,
      action,
      error: error instanceof Error ? error.message : String(error),
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
    newStatus,
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
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
