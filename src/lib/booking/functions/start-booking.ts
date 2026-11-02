import { createServerFn } from '@tanstack/react-start'
import { StartBookingSchema } from '../types'
import { startBooking } from '../start-booking'

/**
 * Start a booking (pickup) from the web app. Verifies the caller is the
 * booking owner, then activates the items and updates the calendar events
 * with the actual start time.
 */
export const startBookingFn = createServerFn({ method: 'POST' })
  .validator(StartBookingSchema)
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    const { booking } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { session, database } = await userContext('Not authenticated')

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
