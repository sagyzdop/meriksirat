import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/bookings/index'
import { getUserBookingsFn } from '@/lib/booking'

export const Route = createFileRoute('/_authenticated/bookings/')({
  component: RouteComponent,
  loader: async () => {
    try {
      const bookingsResponse = await getUserBookingsFn({ data: {} })
      return {
        bookings: bookingsResponse?.data || []
      }
    } catch (error) {
      console.error('Failed to load bookings:', error)
      return {
        bookings: []
      }
    }
  },
})

function RouteComponent() {
  const { bookings } = Route.useLoaderData()
  
  return (
    <Page bookings={bookings} />
  )
}
