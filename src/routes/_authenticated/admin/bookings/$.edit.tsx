import { createFileRoute } from '@tanstack/react-router'
import { getAdminBookingByIdFn } from '@/lib/booking'
import { Page } from '@/components/admin/bookings/$.edit'

export const Route = createFileRoute('/_authenticated/admin/bookings/$/edit')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const bookingId = params._splat
    if (!bookingId) {
      throw new Error('Booking ID is required')
    }

    try {
      const booking = await getAdminBookingByIdFn({ 
        data: { bookingId: parseInt(bookingId) } 
      })

      if (!booking) {
        throw new Error('Booking not found')
      }

      return { 
        booking,
        bookingId: parseInt(bookingId)
      }
    } catch (error) {
      console.error('Failed to load booking:', error)
      throw new Error('Failed to load booking data')
    }
  },
})

function RouteComponent() {
  const { booking, bookingId } = Route.useLoaderData()
  return <Page booking={booking} bookingId={bookingId} />
}
