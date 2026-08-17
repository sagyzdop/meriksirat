/**
 * Telegram Logging
 *
 * Handles logging booking and album activity to the club Telegram channel for
 * audit and notification purposes.
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
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'

const ACTION_LABELS = {
  created: 'Created',
  updated: 'Updated',
  cancelled: 'Cancelled',
  returned: 'Returned',
  deleted: 'Deleted',
} as const

const ALBUM_ACTION_LABELS = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  shared: 'Shared',
  unshared: 'Unshared',
  photo_deleted: 'Photo deleted',
  member_added: 'Editor added',
  member_removed: 'Editor removed',
  token_rotated: 'Share link rotated',
} as const

export type AlbumLogAction = keyof typeof ALBUM_ACTION_LABELS

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

// All log timestamps are rendered in the club's timezone (UTC+5, Asia/Karachi)
// so channel text shows club-local times and never depends on the worker's
// local timezone.
function formatLogDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  }).format(date)
}

function formatLogTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Karachi',
  }).format(date)
}

/**
 * Public app origin used to build resource links in log messages.
 * Reads BETTER_AUTH_URL (same origin the web app is served from).
 */
function appOrigin(): string {
  return (env.BETTER_AUTH_URL ?? '').trim().replace(/\/+$/, '')
}

function bookingUrl(bookingId: number): string {
  const origin = appOrigin()
  return origin ? `${origin}/bookings/${bookingId}` : ''
}

function albumUrl(albumId: string): string {
  const origin = appOrigin()
  return origin ? `${origin}/albums/${albumId}` : ''
}

/**
 * Describes whether an action covered the whole booking or only some of its
 * items, based on the per-item statuses fetched after the action ran.
 */
function getItemStatuses(data: BookingLogData): {
  names: string[]
  statuses: string[]
  target: 'cancelled' | 'returned'
  affected: string[]
} {
  const names = data.equipmentNames?.length
    ? data.equipmentNames
    : data.equipmentName
      ? [data.equipmentName]
      : []
  const statuses = data.itemStatuses ?? []
  const target = data.action === 'cancelled' ? 'cancelled' : 'returned'
  const affected = names
    .map((name, i) => ({ name, status: statuses[i] }))
    .filter((item) => item.status === target)
    .map((item) => item.name)

  return { names, statuses, target, affected }
}

function formatBookingLogMessage(data: BookingLogData): string {
  const { names, statuses, target, affected } = getItemStatuses(data)

  const isPartialEvent =
    statuses.length === names.length &&
    names.length > 0 &&
    affected.length > 0 &&
    affected.length < names.length

  const eventText = isPartialEvent
    ? `${affected.length} of ${names.length} ${
        names.length === 1 ? 'item' : 'items'
      } ${target}`
    : ACTION_LABELS[data.action]

  const lines: string[] = []

  lines.push(`Event: ${eventText} — Booking #${data.bookingId}`)

  const url = bookingUrl(data.bookingId)
  if (url) {
    lines.push(`Resource: ${url}`)
  }

  lines.push(`User: ${data.userName}`)

  if (data.actorName && data.actorName !== data.userName) {
    lines.push(`By: ${data.actorName}`)
  }

  if (
    data.previousStatus &&
    data.newStatus &&
    data.previousStatus !== data.newStatus
  ) {
    lines.push(
      `Status: ${formatStatus(data.previousStatus)} → ${formatStatus(data.newStatus)}`
    )
  }

  if (isPartialEvent) {
    lines.push(`Items ${target}: ${affected.join(', ')}`)
    const remaining = names.filter((_, i) => statuses[i] !== target)
    if (remaining.length > 0) {
      lines.push(`Remaining: ${remaining.join(', ')}`)
    }
  } else if (names.length > 0) {
    lines.push(`Equipment: ${names.join(', ')}`)
  }

  if (data.startTime && data.endTime) {
    lines.push(
      `Time: ${formatLogDate(data.startTime)}, ${formatLogTime(data.startTime)} – ${formatLogTime(data.endTime)}`
    )
  }

  if (data.startedAt) {
    lines.push(`Started: ${formatLogTime(data.startedAt)}`)
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
    })
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
    actorName?: string
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
      actorName: options.actorName,
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

// ---------------------------------------------------------------------------
// Generic channel messages (albums, return photos, ...)
// ---------------------------------------------------------------------------

/**
 * Sends a text message to the club Telegram channel. Never throws.
 */
async function sendChannelText(text: string): Promise<void> {
  if (!isTelegramLoggingEnabled()) return
  try {
    const telegram = createTelegramForLogging(env.TELEGRAM_BOT_TOKEN!)
    await telegram.sendMessage(env.TELEGRAM_CLUB_CHANNEL_ID!, text, {
      disable_web_page_preview: true,
    })
  } catch (error) {
    console.error('Failed to send Telegram channel log:', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Builds the "Name Surname (@telegram)" form of a user record.
 */
function formatLogActor(user: {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  telegramUsername?: string | null
}): string {
  return formatUserDisplayName({
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    name: user.name ?? undefined,
    telegramUsername: user.telegramUsername ?? undefined,
  })
}

/**
 * Logs album activity to the club Telegram channel. Never throws.
 */
export async function logAlbumActivity(input: {
  albumId: string
  albumTitle: string
  action: AlbumLogAction
  actor: {
    firstName?: string | null
    lastName?: string | null
    name?: string | null
    telegramUsername?: string | null
  } | null
  detail?: string
}): Promise<void> {
  if (!isTelegramLoggingEnabled()) return

  const lines = [
    `Event: ${ALBUM_ACTION_LABELS[input.action]} — Album "${input.albumTitle}"`,
  ]
  const url = albumUrl(input.albumId)
  if (url) {
    lines.push(`Resource: ${url}`)
  }
  if (input.actor) {
    lines.push(`By: ${formatLogActor(input.actor)}`)
  }
  if (input.detail) {
    lines.push(input.detail)
  }

  await sendChannelText(lines.join('\n'))
}

/**
 * Logs album activity performed by a user, loading their display info from
 * the database. Never throws.
 */
export async function logAlbumActivityByUser(
  userId: string,
  input: Omit<Parameters<typeof logAlbumActivity>[0], 'actor'>
): Promise<void> {
  try {
    if (!isTelegramLoggingEnabled()) return

    const database = db(env.meriksirat_d1 as D1Database)
    const actor = await database
      .select({
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        telegramUsername: user.telegramUsername,
      })
      .from(user)
      .where(eq(user.id, userId))
      .get()

    await logAlbumActivity({ ...input, actor: actor ?? null })
  } catch (error) {
    console.error('Failed to log album activity:', {
      albumId: input.albumId,
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Logs an equipment return to the club Telegram channel as a single photo
 * message. The caption is the full booking-return log — Event, Resource, user,
 * items, times — rendered by the same formatter the text logs use, so a return
 * produces exactly one channel message. Never throws.
 */
export async function logReturnPhotoToChannel(input: {
  photoFileId: string
  bookingId: number
}): Promise<void> {
  if (!isTelegramLoggingEnabled()) return
  try {
    const bookingDetails = await getBookingDetailsForLogging(input.bookingId)
    if (!bookingDetails) {
      console.warn(`Booking ${input.bookingId} not found for return photo log`)
      return
    }

    const message = formatBookingLogMessage({
      bookingId: bookingDetails.bookingId,
      userId: bookingDetails.userId,
      userName: formatUserDisplayName({
        firstName: bookingDetails.userFirstName,
        lastName: bookingDetails.userLastName,
        name: bookingDetails.userName,
        telegramUsername: bookingDetails.userTelegramUsername,
      }),
      equipmentName: bookingDetails.equipmentName,
      equipmentNames: bookingDetails.equipmentNames,
      itemStatuses: bookingDetails.itemStatuses,
      action: 'returned',
      startTime: bookingDetails.startTime,
      endTime: bookingDetails.endTime,
      startedAt: bookingDetails.startedAt,
    })

    const telegram = createTelegramForLogging(env.TELEGRAM_BOT_TOKEN!)
    await telegram.sendPhoto(env.TELEGRAM_CLUB_CHANNEL_ID!, input.photoFileId, {
      caption: message,
    })
  } catch (error) {
    console.error('Failed to log return photo to Telegram channel:', {
      bookingId: input.bookingId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
