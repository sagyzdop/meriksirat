import { asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { db } from '@/db'
import { booking, bookingItem, category, equipment, user } from '@/db/schema'
import { groupItemsByBooking } from './mappers'
import type { BookingParent } from './mappers'
import type { BookingStatus, BookingWithItems } from './types'

type Database = ReturnType<typeof db>

const END_OF_DAY_MS = 86_399_999

export function bookingFilterConditions(data: {
  status?: BookingStatus[]
  startDate?: string
  endDate?: string
}): SQL[] {
  const conditions: SQL[] = []
  if (data.status && data.status.length > 0) {
    conditions.push(inArray(booking.status, data.status))
  }
  if (data.startDate) {
    conditions.push(gte(booking.startTime, new Date(data.startDate)))
  }
  if (data.endDate) {
    conditions.push(
      lte(
        booking.endTime,
        new Date(new Date(data.endDate).getTime() + END_OF_DAY_MS)
      )
    )
  }
  return conditions
}

export function bookingOrder(sortBy: string, sortOrder: string) {
  const dir = sortOrder === 'desc' ? desc : asc
  switch (sortBy) {
    case 'endTime':
      return dir(booking.endTime)
    case 'status':
      return dir(booking.status)
    case 'createdAt':
      return dir(booking.createdAt)
    case 'equipment':
      return dir(sql`min(${equipment.modelName})`)
    case 'user':
      return dir(user.email)
    default:
      return dir(booking.startTime)
  }
}

export async function countBookings(
  database: Database,
  where: SQL | undefined
): Promise<number> {
  const rows = await database
    .select({ count: sql<number>`count(distinct ${booking.id})` })
    .from(booking)
    .leftJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
    .where(where)
  return rows[0]?.count || 0
}

export async function attachItems(
  database: Database,
  parents: BookingParent[]
): Promise<BookingWithItems[]> {
  if (parents.length === 0) return []
  const itemRows = await database
    .select({
      bookingId: bookingItem.bookingId,
      itemId: bookingItem.id,
      equipmentId: bookingItem.equipmentId,
      itemStatus: bookingItem.status,
      gcalEventId: bookingItem.googleCalendarEventId,
      returnedAt: bookingItem.returnedAt,
      itemCreatedAt: bookingItem.createdAt,
      itemUpdatedAt: bookingItem.updatedAt,
      eqId: equipment.id,
      eqModelName: equipment.modelName,
      eqDescription: equipment.description,
      eqCategoryId: equipment.categoryId,
      eqImagePath: equipment.imagePath,
      eqGcalId: equipment.googleCalendarId,
      catId: category.id,
      catName: category.name,
    })
    .from(bookingItem)
    .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .leftJoin(category, eq(equipment.categoryId, category.id))
    .where(
      inArray(
        bookingItem.bookingId,
        parents.map((p) => p.id)
      )
    )
    .orderBy(bookingItem.id)
  return groupItemsByBooking(parents, itemRows)
}
