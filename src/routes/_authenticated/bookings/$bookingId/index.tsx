import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { Page } from '@/components/bookings/$bookingId'
import { getBookingByIdFn, getTelegramBotUsernameFn } from '@/lib/booking'
import { z } from 'zod'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { numberArrayParam } from '@/lib/search-params'

const BookingDetailSearchSchema = z.object({
  bookingId: z.coerce.number().optional(),
  equipmentIds: numberArrayParam(),
})

export const Route = createFileRoute('/_authenticated/bookings/$bookingId/')({
  component: RouteComponent,
  validateSearch: BookingDetailSearchSchema,
  loader: async ({ params }) => {
    const bookingId = parseInt(params.bookingId || '0')

    if (!bookingId || isNaN(bookingId)) {
      throw new Error('Invalid booking ID')
    }

    try {
      const booking = await getBookingByIdFn({ data: { bookingId } })

      if (!booking) {
        throw new Error('Booking not found')
      }

      return {
        booking,
        telegramBotUsername: await getTelegramBotUsernameFn(),
      }
    } catch (error) {
      console.error('Failed to load booking:', error)
      throw error
    }
  },
})

function RouteComponent() {
  const { booking, telegramBotUsername } = Route.useLoaderData()
  const isLoading = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page booking={booking} telegramBotUsername={telegramBotUsername} />
    </div>
  )
}
