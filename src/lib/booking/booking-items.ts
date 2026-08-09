import type { db } from '@/db'
import { bookingItem, equipment } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { recomputeBookingStatus } from '@/lib/booking/status'
import { deleteCalendarEvent } from '@/lib/google/google-caledar'

type BookingDatabase = ReturnType<typeof db>

/**
 * Shared per-item booking actions.
 *
 * These are the single source of truth for cancelling/returning booking items.
 * They are reused by the Telegram bot flows (/cancel_booking, /return_equipment
 * photo completion) and by the web booking pages.
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

export async function cancelBookingItems(
  database: BookingDatabase,
  itemIds: number[]
): Promise<BookingItemActionResult> {
  const items = await database
    .select({
      id: bookingItem.id,
      bookingId: bookingItem.bookingId,
      itemStatus: bookingItem.status,
      equipmentName: equipment.modelName,
      googleCalendarEventId: bookingItem.googleCalendarEventId,
      equipmentCalendarId: equipment.googleCalendarId,
    })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(inArray(bookingItem.id, itemIds))

  const cancellable = items.filter(
    (it) => it.itemStatus !== 'cancelled' && it.itemStatus !== 'returned'
  )

  if (cancellable.length === 0) {
    return { updated: [], touchedBookings: [] }
  }

  await database
    .update(bookingItem)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(inArray(bookingItem.id, cancellable.map((it) => it.id)))

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
        console.error('Failed to delete calendar event for cancelled item:', err)
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
  const items = await database
    .select({
      id: bookingItem.id,
      bookingId: bookingItem.bookingId,
      itemStatus: bookingItem.status,
      equipmentName: equipment.modelName,
      googleCalendarEventId: bookingItem.googleCalendarEventId,
      equipmentCalendarId: equipment.googleCalendarId,
    })
    .from(bookingItem)
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(inArray(bookingItem.id, itemIds))

  const returnable = items.filter(
    (it) => it.itemStatus !== 'returned' && it.itemStatus !== 'cancelled'
  )

  if (returnable.length === 0) {
    return { updated: [], touchedBookings: [] }
  }

  await database
    .update(bookingItem)
    .set({ status: 'returned', returnedAt: new Date(), updatedAt: new Date() })
    .where(inArray(bookingItem.id, returnable.map((it) => it.id)))

  const touchedBookings = [...new Set(returnable.map((it) => it.bookingId))]

  for (const bookingId of touchedBookings) {
    try {
      await recomputeBookingStatus(database, bookingId)
    } catch (err) {
      console.error(`Failed to recompute status for booking ${bookingId}:`, err)
    }
  }

  for (const it of returnable) {
    if (it.googleCalendarEventId && it.equipmentCalendarId) {
      try {
        await deleteCalendarEvent({
          data: {
            equipmentCalendarId: it.equipmentCalendarId,
            eventId: it.googleCalendarEventId,
          },
        })
      } catch (err) {
        console.error('Failed to delete calendar event for returned item:', err)
      }
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
