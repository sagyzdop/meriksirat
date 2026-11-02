import { db } from '@/db'
import { eq, and, inArray } from 'drizzle-orm'
import { booking, bookingItem, equipment } from '@/db/schema'
import type { BotContext } from './context'
import { groupBookingRows } from './group-rows'

type ItemStatus = (typeof bookingItem.$inferSelect)['status']

export async function fetchUserBookings(
  ctx: BotContext,
  userId: string,
  statuses: ItemStatus[]
) {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  const rows = await database
    .select({
      bookingId: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      itemId: bookingItem.id,
      equipmentName: equipment.modelName,
      itemStatus: bookingItem.status,
    })
    .from(booking)
    .innerJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(eq(booking.userId, userId), inArray(bookingItem.status, statuses))
    )
    .orderBy(booking.startTime, bookingItem.id)

  return groupBookingRows(rows)
}

export async function fetchBookingItems(
  ctx: BotContext,
  userId: string,
  bookingId: number,
  statuses: ItemStatus[]
): Promise<Array<{ itemId: number; equipmentName: string }>> {
  const database = db(ctx.env.meriksirat_d1 as D1Database)

  return await database
    .select({
      itemId: bookingItem.id,
      equipmentName: equipment.modelName,
    })
    .from(bookingItem)
    .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
    .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
    .where(
      and(
        eq(bookingItem.bookingId, bookingId),
        eq(booking.userId, userId),
        inArray(bookingItem.status, statuses)
      )
    )
    .orderBy(bookingItem.id)
}
