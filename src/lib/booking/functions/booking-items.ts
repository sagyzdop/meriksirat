import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { CancelBookingItemSchema } from '../types'

/**
 * Per-item booking action for the web UI.
 *
 * Cancelling an item delegates to the shared booking-items logic (the same
 * logic used by the Telegram bot /cancel_booking flow). Returns are handled
 * through Telegram, so there is no web return action.
 */

async function assertBookingAccess(params: {
  headers: Headers
  database: any
  bookingId: number
  sessionUserId: string
}) {
  const { booking } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')

  const bookingRow = await params.database
    .select({ userId: booking.userId })
    .from(booking)
    .where(eq(booking.id, params.bookingId))
    .limit(1)

  const bookingData = bookingRow[0]
  if (!bookingData) {
    throw new Error('Booking not found')
  }

  if (bookingData.userId !== params.sessionUserId) {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    await checkAdminPermission(params.headers, ['admin', 'manager'])
  }
}

export const cancelBookingItemFn = createServerFn({ method: 'POST' })
  .validator(CancelBookingItemSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { cancelBookingItems } = await import('../booking-items')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })
    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    await assertBookingAccess({
      headers,
      database,
      bookingId: data.bookingId,
      sessionUserId: session.user.id,
    })

    const result = await cancelBookingItems(database, [data.itemId])

    if (result.updated.length === 0) {
      throw new Error('Item is already cancelled or returned')
    }

    for (const bookingId of result.touchedBookings) {
      try {
        await logBookingActivityById(bookingId, 'cancelled', {
          newStatus: 'cancelled',
          notes: 'Item cancelled via web',
        })
      } catch (logError) {
        console.error('Failed to log item cancellation:', logError)
      }
    }

    return { success: true }
  })
