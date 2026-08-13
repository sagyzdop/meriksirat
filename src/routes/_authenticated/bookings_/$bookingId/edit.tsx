import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { getBookingByIdFn, getTelegramBotUsernameFn } from '@/lib/booking'
import { Page } from '@/components/bookings/bookings_/$bookingId.edit'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { z } from 'zod'
import { numberArrayParam } from '@/lib/search-params'

const EditBookingSearchSchema = z.object({
  equipmentIds: numberArrayParam(),
})

export const Route = createFileRoute(
  '/_authenticated/bookings_/$bookingId/edit'
)({
  component: RouteComponent,
  validateSearch: EditBookingSearchSchema,
  loader: async ({ params }) => {
    const bookingId = params.bookingId
    if (!bookingId) {
      throw new Error('Booking ID is required')
    }

    try {
      const booking = await getBookingByIdFn({
        data: { bookingId: parseInt(bookingId) },
      })

      if (!booking) {
        throw new Error('Booking not found')
      }

      return {
        booking,
        bookingId: parseInt(bookingId),
        telegramBotUsername: await getTelegramBotUsernameFn(),
      }
    } catch (error) {
      console.error('Failed to load booking:', error)
      throw new Error('Failed to load booking data')
    }
  },
})

function RouteComponent() {
  const { booking, bookingId, telegramBotUsername } = Route.useLoaderData()
  const isLoading = useRouterState({
    select: (state) => state.status === 'pending',
  })
  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page
        booking={booking}
        bookingId={bookingId}
        telegramBotUsername={telegramBotUsername}
      />
    </div>
  )
}
