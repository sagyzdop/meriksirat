import type { BookingWithItems } from './types'
import type { bookingItem, equipment, category } from '@/db/schema'

/**
 * Shared select fragment for booking_item + equipment + category joins.
 * Column aliases must match the BookingItemRow shape.
 */
export function itemSelect(
  bItem: typeof bookingItem,
  eq: typeof equipment,
  cat: typeof category
) {
  return {
    itemId: bItem.id,
    equipmentId: bItem.equipmentId,
    itemStatus: bItem.status,
    gcalEventId: bItem.googleCalendarEventId,
    returnedAt: bItem.returnedAt,
    itemCreatedAt: bItem.createdAt,
    itemUpdatedAt: bItem.updatedAt,
    eqId: eq.id,
    eqModelName: eq.modelName,
    eqDescription: eq.description,
    eqCategoryId: eq.categoryId,
    eqImagePath: eq.imagePath,
    eqGcalId: eq.googleCalendarId,
    catId: cat.id,
    catName: cat.name,
  }
}

/**
 * Flat row shape produced by queries that join
 * booking -> booking_item -> equipment -> category.
 */
export interface BookingItemRow {
  bookingId: number
  userId: string
  startTime: Date
  endTime: Date
  status: string
  userEventDetails: string | null
  startedAt: Date | null
  createdAt: Date
  updatedAt: Date
  itemId: number
  equipmentId: number
  itemStatus: string
  gcalEventId: string | null
  returnedAt: Date | null
  itemCreatedAt: Date
  itemUpdatedAt: Date
  eqId: number | null
  eqModelName: string | null
  eqDescription: string | null
  eqCategoryId: number | null
  eqImagePath: string | null
  eqGcalId: string | null
  catId: number | null
  catName: string | null
}

/**
 * Group flat joined rows into parent bookings with their item arrays.
 * Rows must be ordered by bookingId for deterministic output.
 */
export function mapBookingsWithItems(
  rows: BookingItemRow[]
): BookingWithItems[] {
  const map = new Map<number, BookingWithItems>()

  for (const row of rows) {
    let booking = map.get(row.bookingId)
    if (!booking) {
      booking = {
        id: row.bookingId,
        userId: row.userId,
        startTime: row.startTime,
        endTime: row.endTime,
        status: row.status,
        userEventDetails: row.userEventDetails,
        startedAt: row.startedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        items: [],
      }
      map.set(row.bookingId, booking)
    }

    // Skip synthetic empty-item rows (itemId === 0)
    if (!row.itemId) continue

    booking.items.push({
      id: row.itemId,
      equipmentId: row.equipmentId,
      status: row.itemStatus,
      googleCalendarEventId: row.gcalEventId,
      returnedAt: row.returnedAt,
      createdAt: row.itemCreatedAt,
      updatedAt: row.itemUpdatedAt,
      equipment: row.eqId
        ? {
            id: row.eqId,
            modelName: row.eqModelName!,
            description: row.eqDescription,
            categoryId: row.eqCategoryId,
            imagePath: row.eqImagePath,
            googleCalendarId: row.eqGcalId!,
            category: row.catId ? { id: row.catId, name: row.catName! } : null,
          }
        : null,
    })
  }

  return [...map.values()]
}
