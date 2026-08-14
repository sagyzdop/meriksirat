import type { db } from '@/db'
import { booking, bookingItem, equipment, user } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { recomputeBookingStatus } from '@/lib/booking/status'
import {
  deleteCalendarEvent,
  updateCalendarEvent,
  toCalendarDateTime,
  CLUB_TIMEZONE,
} from '@/lib/google/google-caledar'
import { formatBookingDetailsPlain } from '@/lib/booking/details'
import { formatUserDisplayName } from '@/lib/utils'

type BookingDatabase = ReturnType<typeof db>

/**
 * Shared per-item booking actions.
 *
 * These are the single source of truth for cancelling/returning booking items.
 * They are reused by the Telegram bot flows (/cancel_booking, /return_equipment
 * photo completion) and by the web booking pages.
 *
 * Calendar event rules:
 * - Cancel always deletes the event.
 * - Return updates the event end time to the ACTUAL return time (uncapped, so
 *   a late return is reflected exactly). The event is kept once the booking
 *   has started. If the booking was never started, the event is kept with the
 *   booked start time as its start so the return history is preserved.
 */

export interface BookingItemActionResult {
  updated: Array<{
    id: number
    bookingId: number
    equipmentName: string
    itemStatus: string
  }>
  touchedBookings: number[]
}

interface BookingItemWithContext {
  id: number
  bookingId: number
  itemStatus: string
  equipmentName: string
  googleCalendarEventId: string | null
  equipmentCalendarId: string | null
  startedAt: Date | null
  bookingStartTime: Date
  bookingEndTime: Date
  userEventDetails: string | null
  userFirstName: string | null
  userLastName: string | null
  userName: string | null
  userTelegramUsername: string | null
  userEmail: string | null
}

async function selectItemsWithContext(
  database: BookingDatabase,
  itemIds: number[]
): Promise<BookingItemWithContext[]> {
  return database
    .select({
      id: bookingItem.id,
      bookingId: bookingItem.bookingId,
      itemStatus: bookingItem.status,
      equipmentName: equipment.modelName,
      googleCalendarEventId: bookingItem.googleCalendarEventId,
      equipmentCalendarId: equipment.googleCalendarId,
      startedAt: booking.startedAt,
      bookingStartTime: booking.startTime,
      bookingEndTime: booking.endTime,
      userEventDetails: booking.userEventDetails,
      userFirstName: user.firstName,
      userLastName: user.lastName,
      userName: user.name,
      userTelegramUsername: user.telegramUsername,
      userEmail: user.email,
    })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
    .innerJoin(user, eq(booking.userId, user.id))
    .where(inArray(bookingItem.id, itemIds))
}

function buildItemEventDetails(
  item: BookingItemWithContext,
  status: string,
  returnedAt?: Date | null
) {
  const userDisplayName = formatUserDisplayName({
    firstName: item.userFirstName,
    lastName: item.userLastName,
    name: item.userName,
    telegramUsername: item.userTelegramUsername,
  })

  return formatBookingDetailsPlain({
    bookingId: item.bookingId,
    userDisplayName,
    equipmentNames: [item.equipmentName],
    startTime: item.bookingStartTime,
    endTime: item.bookingEndTime,
    startedAt: item.startedAt,
    returnedAt,
    status,
    notes: item.userEventDetails,
  })
}

export async function cancelBookingItems(
  database: BookingDatabase,
  itemIds: number[]
): Promise<BookingItemActionResult> {
  const items = await selectItemsWithContext(database, itemIds)

  const cancellable = items.filter(
    (it) => it.itemStatus !== 'cancelled' && it.itemStatus !== 'returned'
  )

  if (cancellable.length === 0) {
    return { updated: [], touchedBookings: [] }
  }

  await database
    .update(bookingItem)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      inArray(
        bookingItem.id,
        cancellable.map((it) => it.id)
      )
    )

  const touchedBookings = [...new Set(cancellable.map((it) => it.bookingId))]

  for (const bookingId of touchedBookings) {
    try {
      await recomputeBookingStatus(database, bookingId)
    } catch (err) {
      console.error(`Failed to recompute status for booking ${bookingId}:`, err)
    }
  }

  for (const it of cancellable) {
    if (it.googleCalendarEventId && it.equipmentCalendarId) {
      try {
        await deleteCalendarEvent({
          data: {
            equipmentCalendarId: it.equipmentCalendarId,
            eventId: it.googleCalendarEventId,
          },
        })
      } catch (err) {
        console.error(
          'Failed to delete calendar event for cancelled item:',
          err
        )
      }
    }
  }

  return {
    updated: cancellable.map((it) => ({
      id: it.id,
      bookingId: it.bookingId,
      equipmentName: it.equipmentName,
      itemStatus: it.itemStatus,
    })),
    touchedBookings,
  }
}

export async function returnBookingItems(
  database: BookingDatabase,
  itemIds: number[]
): Promise<BookingItemActionResult> {
  const items = await selectItemsWithContext(database, itemIds)

  const returnable = items.filter(
    (it) => it.itemStatus !== 'returned' && it.itemStatus !== 'cancelled'
  )

  if (returnable.length === 0) {
    return { updated: [], touchedBookings: [] }
  }

  const returnedAt = new Date()

  await database
    .update(bookingItem)
    .set({ status: 'returned', returnedAt, updatedAt: new Date() })
    .where(
      inArray(
        bookingItem.id,
        returnable.map((it) => it.id)
      )
    )

  const touchedBookings = [...new Set(returnable.map((it) => it.bookingId))]

  for (const bookingId of touchedBookings) {
    try {
      await recomputeBookingStatus(database, bookingId)
    } catch (err) {
      console.error(`Failed to recompute status for booking ${bookingId}:`, err)
    }
  }

  for (const it of returnable) {
    if (!it.googleCalendarEventId || !it.equipmentCalendarId) continue

    try {
      const eventStart = it.startedAt ?? it.bookingStartTime

      await updateCalendarEvent({
        data: {
          equipmentCalendarId: it.equipmentCalendarId,
          eventId: it.googleCalendarEventId,
          event: {
            summary: `${it.equipmentName} (RETURNED)`,
            description: buildItemEventDetails(it, 'returned', returnedAt),
            start: { dateTime: toCalendarDateTime(eventStart), timeZone: CLUB_TIMEZONE },
            end: { dateTime: toCalendarDateTime(returnedAt), timeZone: CLUB_TIMEZONE },
          },
          userEmail: it.userEmail || '',
        },
      })
    } catch (err) {
      console.error('Failed to update calendar event for returned item:', err)
    }
  }

  return {
    updated: returnable.map((it) => ({
      id: it.id,
      bookingId: it.bookingId,
      equipmentName: it.equipmentName,
      itemStatus: it.itemStatus,
    })),
    touchedBookings,
  }
}
