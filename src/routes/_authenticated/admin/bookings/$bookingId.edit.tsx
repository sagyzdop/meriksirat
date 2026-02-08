import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { getAdminBookingByIdFn } from '@/lib/booking'
import { Page } from '@/components/admin/bookings/$.edit'
import { LoadingOverlay } from '@/components/shared/loading-overlay'

export const Route = createFileRoute('/_authenticated/admin/bookings/$bookingId/edit')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const bookingId = params.bookingId
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
  const isLoading = useRouterState({ select: (state) => state.status === 'pending' })
  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page booking={booking} bookingId={bookingId} />
    </div>
  )
}
