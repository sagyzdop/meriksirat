import type { db } from '@/db'
import { booking, bookingItem, equipment, user } from '@/db/schema'
import { eq, and, inArray, isNull } from 'drizzle-orm'
import { updateCalendarEvent, toCalendarDateTime, CLUB_TIMEZONE } from '@/lib/google/google-caledar'
import { formatBookingDetailsPlain } from '@/lib/booking/details'
import { formatUserDisplayName } from '@/lib/utils'
import { logBookingActivityById } from '@/lib/telegram/logging'
import { recomputeBookingStatus } from '@/lib/booking/status'

type BookingDatabase = ReturnType<typeof db>

export const START_WINDOW_GRACE_MS = 15 * 60 * 1000

/**
 * Shared "start booking" logic used by both the web "Start pickup" flow and the
 * Telegram "Start Booking" command.
 *
 * Starting a booking:
 * - Requires status `booked` and an open start window (now within
 *   [startTime - 15min, startTime + 15min]).
 * - Records `startedAt` (actual pickup time).
 * - Activates all non-cancelled items.
 * - Updates each Google Calendar event: start becomes the ACTUAL start time,
 *   end stays the booked end time, summary `(ACTIVE)`.
 */
export async function startBooking(
  database: BookingDatabase,
  bookingId: number
): Promise<{ bookingId: number }> {
  const now = new Date()

  const parent = await database
    .select({
      id: booking.id,
      userId: booking.userId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      startedAt: booking.startedAt,
      userEventDetails: booking.userEventDetails,
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        telegramUsername: user.telegramUsername,
      },
    })
    .from(booking)
    .innerJoin(user, eq(booking.userId, user.id))
    .where(eq(booking.id, bookingId))
    .limit(1)

  const bookingData = parent[0]
  if (!bookingData) {
    throw new Error('Booking not found')
  }

  if (bookingData.status !== 'booked') {
    throw new Error(
      `Booking cannot be started from status "${bookingData.status}"`
    )
  }

  if (bookingData.startedAt) {
    throw new Error('Booking has already been started')
  }

  const windowStart = new Date(
    bookingData.startTime.getTime() - START_WINDOW_GRACE_MS
  )
  const windowEnd = new Date(
    bookingData.startTime.getTime() + START_WINDOW_GRACE_MS
  )
  if (now < windowStart) {
    throw new Error(
      'Booking can be started up to 15 minutes before the start time'
    )
  }
  if (now > windowEnd) {
    throw new Error(
      'Booking start window has passed; the booking will be auto-cancelled'
    )
  }

  const items = await database
    .select({
      id: bookingItem.id,
      status: bookingItem.status,
      googleCalendarEventId: bookingItem.googleCalendarEventId,
      equipmentCalendarId: equipment.googleCalendarId,
      equipmentName: equipment.modelName,
      equipmentId: equipment.id,
    })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(eq(bookingItem.bookingId, bookingId))

  const startable = items.filter(
    (it) => it.status !== 'cancelled' && it.status !== 'returned'
  )

  if (startable.length === 0) {
    throw new Error('Booking has no items that can be started')
  }

  await database
    .update(booking)
    .set({ startedAt: now, updatedAt: now })
    .where(eq(booking.id, bookingId))

  await database
    .update(bookingItem)
    .set({ status: 'active', updatedAt: now })
    .where(
      inArray(
        bookingItem.id,
        startable.map((it) => it.id)
      )
    )

  await recomputeBookingStatus(database, bookingId)

  const userDisplayName = formatUserDisplayName(bookingData.user)

  for (const item of startable) {
    if (!item.googleCalendarEventId || !item.equipmentCalendarId) continue

    try {
      await updateCalendarEvent({
        data: {
          equipmentCalendarId: item.equipmentCalendarId,
          eventId: item.googleCalendarEventId,
          event: {
            summary: `${item.equipmentName || `Equipment ${item.equipmentId}`} (ACTIVE)`,
            description: formatBookingDetailsPlain({
              bookingId,
              userDisplayName,
              equipmentNames: [
                item.equipmentName || `Equipment ${item.equipmentId}`,
              ],
              startTime: bookingData.startTime,
              endTime: bookingData.endTime,
              startedAt: now,
              status: 'active',
              notes: bookingData.userEventDetails,
            }),
            start: { dateTime: toCalendarDateTime(now), timeZone: CLUB_TIMEZONE },
            end: {
              dateTime: toCalendarDateTime(bookingData.endTime),
              timeZone: CLUB_TIMEZONE,
            },
          },
          userEmail: bookingData.user?.email || '',
        },
      })
    } catch (error) {
      console.error(
        `Failed to update calendar event on start for item ${item.id}:`,
        error
      )
    }
  }

  try {
    await logBookingActivityById(bookingId, 'updated', {
      previousStatus: 'booked',
      newStatus: 'active',
    })
  } catch (error) {
    console.error('Failed to log booking start:', error)
  }

  return { bookingId }
}

/**
 * Returns bookings whose start window is currently open (now within
 * [startTime - 15min, startTime + 15min]) and that can still be started.
 */
export async function listStartableBookings(
  database: BookingDatabase,
  userId: string
): Promise<
  Array<{ id: number; startTime: Date; endTime: Date; status: string }>
> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - START_WINDOW_GRACE_MS)
  const windowEnd = new Date(now.getTime() + START_WINDOW_GRACE_MS)

  const rows = await database
    .select({
      id: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
    })
    .from(booking)
    .where(
      and(
        eq(booking.userId, userId),
        eq(booking.status, 'booked'),
        isNull(booking.startedAt)
      )
    )
    .orderBy(booking.startTime)

  return rows.filter(
    (b) => b.startTime <= windowEnd && b.startTime >= windowStart
  )
}
