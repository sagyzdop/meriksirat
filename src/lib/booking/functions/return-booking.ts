import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { ReturnBookingSchema } from '../types'

const RETURNABLE_STATUSES = ['active', 'partially_returned', 'overdue']

/**
 * Return a booking (all its items) from the web app. Verifies the caller is
 * the booking owner (or an admin/manager), then marks every outstanding item
 * as returned and updates the calendar events with the actual return time.
 */
export const returnBookingFn = createServerFn({ method: 'POST' })
  .validator(ReturnBookingSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { returnBookingItems } = await import('../booking-items')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    const bookingRow = await database
      .select({ userId: booking.userId, status: booking.status })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .get()

    if (!bookingRow) {
      throw new Error('Booking not found')
    }

    if (bookingRow.userId !== session.user.id) {
      const { checkAdminPermission } = await import('@/lib/admin/server')
      await checkAdminPermission(headers, ['admin', 'manager'])
    }

    if (!RETURNABLE_STATUSES.includes(bookingRow.status)) {
      throw new Error('Booking can only be returned after it has started')
    }

    const items = await database
      .select({ id: bookingItem.id })
      .from(bookingItem)
      .where(eq(bookingItem.bookingId, data.bookingId))

    const result = await returnBookingItems(
      database,
      items.map((item) => item.id)
    )

    if (result.updated.length === 0) {
      throw new Error('All items are already returned or cancelled')
    }

    for (const bookingId of result.touchedBookings) {
      try {
        await logBookingActivityById(bookingId, 'returned', {
          previousStatus: bookingRow.status,
          notes: 'Booking returned via web',
        })
      } catch (logError) {
        console.error('Failed to log booking return:', logError)
      }
    }

    return { success: true }
  })
