import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { StartBookingSchema } from '../types'
import { startBooking, listStartableBookings } from '../start-booking'

/**
 * Start a booking (pickup) from the web app. Verifies the caller is the
 * booking owner, then activates the items and updates the calendar events
 * with the actual start time.
 */
export const startBookingFn = createServerFn({ method: 'POST' })
  .validator(StartBookingSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    const bookingData = await database
      .select({ userId: booking.userId })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const parent = bookingData[0]
    if (!parent) {
      throw new Error('Booking not found')
    }

    if (parent.userId !== session.user.id) {
      throw new Error('You can only start your own bookings')
    }

    await startBooking(database, data.bookingId)

    return { success: true }
  })

/**
 * List the current user's bookings whose start window is open and can be
 * started right now.
 */
export const getStartableBookingsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      return []
    }

    const database = db(env.meriksirat_d1 as D1Database)
    return listStartableBookings(database, session.user.id)
  })
