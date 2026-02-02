import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/bookings/$/page'
import { getBookingByIdFn } from '@/lib/booking'
import { z } from 'zod'

const BookingDetailSearchSchema = z.object({
  bookingId: z.coerce.number().optional(),
})

export const Route = createFileRoute('/_authenticated/bookings/$')({
  component: RouteComponent,
  validateSearch: BookingDetailSearchSchema,
  loader: async ({ params }) => {
    const bookingId = parseInt(params._splat || '0')
    
    if (!bookingId || isNaN(bookingId)) {
      throw new Error('Invalid booking ID')
    }

    try {
      const booking = await getBookingByIdFn({ data: { bookingId } })
      
      if (!booking) {
        throw new Error('Booking not found')
      }

      return { booking }
    } catch (error) {
      console.error('Failed to load booking:', error)
      throw error
    }
  },
})

function RouteComponent() {
  const { booking } = Route.useLoaderData()
  
  return (
    <Page booking={booking} />
  )
}
