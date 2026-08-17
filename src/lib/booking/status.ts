import type { BookingStatus } from '@/lib/telegram/types'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '@/db/schema'

/**
 * Derive a parent booking's status from the statuses of its items.
 *
 * Rules:
 * - all items cancelled  -> cancelled
 * - all items returned   -> returned
 * - any item overdue     -> overdue
 * - no active items left (every non-cancelled item is returned) -> returned
 * - some items returned, others still active/booked -> partially_returned
 * - any item active      -> active
 * - otherwise            -> booked
 */
export function deriveParentBookingStatus(
  itemStatuses: string[]
): BookingStatus {
  if (itemStatuses.length === 0) return 'cancelled'

  const statuses = new Set(itemStatuses)
  if (statuses.size === 1 && statuses.has('cancelled')) return 'cancelled'
  if (statuses.size === 1 && statuses.has('returned')) return 'returned'
  if (statuses.has('overdue')) return 'overdue'

  // Every item that was actually taken out has been returned; the only
  // remaining items are cancelled ones, so the booking is fully done.
  const activeItems = itemStatuses.filter(
    (s) => s !== 'cancelled' && s !== 'returned'
  )
  if (activeItems.length === 0) return 'returned'
  if (statuses.has('returned')) return 'partially_returned'
  if (statuses.has('active')) return 'active'
  return 'booked'
}

/**
 * Recompute and persist a parent booking's status from its items' statuses.
 * Returns the newly derived status.
 */
export async function recomputeBookingStatus(
  database: DrizzleD1Database<typeof schema>,
  bookingId: number
): Promise<BookingStatus> {
  const { bookingItem, booking } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')

  const itemRows = await database
    .select({ status: bookingItem.status })
    .from(bookingItem)
    .where(eq(bookingItem.bookingId, bookingId))

  const status = deriveParentBookingStatus(
    itemRows.map((row: { status: string }) => row.status)
  )

  await database
    .update(booking)
    .set({ status, updatedAt: new Date() })
    .where(eq(booking.id, bookingId))

  return status
}
