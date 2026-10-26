/**
 * Telegram Logging
 *
 * Handles logging booking and album activity to the club Telegram channel for
 * audit and notification purposes. Message text is built in `./log-format`.
 */

import { env } from 'cloudflare:workers'
import {
  createTelegramForLogging,
  isTelegramLoggingEnabled,
  getBookingDetailsForLogging,
} from './server-utils'
import {
  formatAlbumLog,
  formatBookingLog,
  visibleLength,
  MAX_CAPTION_LENGTH,
  type AlbumLogAction,
  type BookingLogData,
  type BookingLogEvent,
} from './log-format'
import { formatUserDisplayName } from '@/lib/utils'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'

export type { AlbumLogAction, BookingLogEvent }

export type BookingLogOptions = Pick<
  BookingLogData,
  | 'actorName'
  | 'previous'
  | 'addedItems'
  | 'extendedMinutes'
  | 'overdueCleared'
  | 'reason'
>

/**
 * Public app origin used to build resource links in log messages.
 * Reads BETTER_AUTH_URL (same origin the web app is served from).
 */
function appOrigin(): string {
  return (env.BETTER_AUTH_URL ?? '').trim().replace(/\/+$/, '')
}

function bookingUrl(bookingId: number): string | undefined {
  const origin = appOrigin()
  return origin ? `${origin}/admin/bookings/${bookingId}` : undefined
}

function albumUrl(albumId: string): string | undefined {
  const origin = appOrigin()
  return origin ? `${origin}/albums/${albumId}` : undefined
}

/**
 * Loads the booking's current state and merges in the event-specific options.
 */
async function loadBookingLogData(
  bookingId: number,
  event: BookingLogEvent,
  options: BookingLogOptions
): Promise<BookingLogData | null> {
  const details = await getBookingDetailsForLogging(bookingId)
  if (!details) return null

  return {
    bookingId: details.bookingId,
    event,
    userName: formatUserDisplayName({
      firstName: details.userFirstName,
      lastName: details.userLastName,
      name: details.userName,
      telegramUsername: details.userTelegramUsername,
    }),
    equipmentNames: details.equipmentNames,
    itemStatuses: details.itemStatuses,
    startTime: details.startTime,
    endTime: details.endTime,
    startedAt: details.startedAt,
    eventDetails: details.notes,
    url: bookingUrl(details.bookingId),
    ...options,
  }
}

/**
 * Sends an HTML message to the club Telegram channel. Never throws.
 */
async function sendChannelText(text: string): Promise<void> {
  if (!isTelegramLoggingEnabled()) return
  try {
    const telegram = createTelegramForLogging(env.TELEGRAM_BOT_TOKEN!)
    await telegram.sendMessage(env.TELEGRAM_CLUB_CHANNEL_ID!, text, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
  } catch (error) {
    console.error('Failed to send Telegram channel log:', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Logs a booking event to the club Telegram channel, loading the booking's
 * current state from the database. Never throws.
 */
export async function logBookingActivityById(
  bookingId: number,
  event: BookingLogEvent,
  options: BookingLogOptions = {}
): Promise<void> {
  try {
    if (!isTelegramLoggingEnabled()) return

    const data = await loadBookingLogData(bookingId, event, options)
    if (!data) {
      console.warn(`Booking ${bookingId} not found for logging`)
      return
    }

    await sendChannelText(formatBookingLog(data))
  } catch (error) {
    console.error('Failed to log booking activity by ID:', {
      bookingId,
      event,
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
  details?: string[]
}): Promise<void> {
  if (!isTelegramLoggingEnabled()) return

  await sendChannelText(
    formatAlbumLog({
      albumId: input.albumId,
      albumTitle: input.albumTitle,
      action: input.action,
      actorName: input.actor ? formatLogActor(input.actor) : null,
      details: input.details,
      url: albumUrl(input.albumId),
    })
  )
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
 * message whose caption is the full "Returned" booking log. Falls back to an
 * item count when the equipment list would push the caption past Telegram's
 * limit. Never throws.
 */
export async function logReturnPhotoToChannel(input: {
  photoFileId: string
  bookingId: number
}): Promise<void> {
  if (!isTelegramLoggingEnabled()) return
  try {
    const data = await loadBookingLogData(input.bookingId, 'returned', {})
    if (!data) {
      console.warn(`Booking ${input.bookingId} not found for return photo log`)
      return
    }

    let caption = formatBookingLog(data)
    if (visibleLength(caption) > MAX_CAPTION_LENGTH) {
      caption = formatBookingLog(data, { compactEquipment: true })
    }

    const telegram = createTelegramForLogging(env.TELEGRAM_BOT_TOKEN!)
    await telegram.sendPhoto(env.TELEGRAM_CLUB_CHANNEL_ID!, input.photoFileId, {
      caption,
      parse_mode: 'HTML',
    })
  } catch (error) {
    console.error('Failed to log return photo to Telegram channel:', {
      bookingId: input.bookingId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
