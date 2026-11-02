import type { BookingItemWithEquipment, BookingWithItems } from './types'

export interface ItemRow {
  bookingId: number
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

export type BookingParent = Omit<BookingWithItems, 'items'>

function toItem(row: ItemRow): BookingItemWithEquipment {
  return {
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
  }
}

export function groupItemsByBooking(
  parents: BookingParent[],
  itemRows: ItemRow[]
): BookingWithItems[] {
  const byBooking = new Map<number, BookingItemWithEquipment[]>()
  for (const row of itemRows) {
    const list = byBooking.get(row.bookingId) ?? []
    list.push(toItem(row))
    byBooking.set(row.bookingId, list)
  }

  return parents.map((p) => ({
    id: p.id,
    userId: p.userId,
    startTime: p.startTime,
    endTime: p.endTime,
    status: p.status,
    userEventDetails: p.userEventDetails,
    startedAt: p.startedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    items: byBooking.get(p.id) ?? [],
  }))
}
