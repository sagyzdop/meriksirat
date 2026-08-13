import { BookingDetail } from '@/components/shared/booking-detail'
import { cancelBookingFn, startBookingFn } from '@/lib/booking'
import { useAddBookingItems } from '@/hooks/use-add-booking-items'
import type { BookingWithItems } from '@/lib/booking/types'

interface PageProps {
  booking: BookingWithItems
  telegramBotUsername: string
}

export function Page({ booking, telegramBotUsername }: PageProps) {
  const now = new Date()
  const canCancel = booking.status === 'booked'
  const canStart =
    booking.status === 'booked' &&
    !booking.startedAt &&
    new Date(booking.startTime) <= now &&
    now.getTime() <= new Date(booking.startTime).getTime() + 15 * 60 * 1000

  useAddBookingItems(booking.id)

  return (
    <BookingDetail
      booking={booking}
      onBack={() => history.back()}
      editTo="/bookings/$bookingId/edit"
      canAddEquipment={booking.status === 'booked'}
      returnTo={`/bookings/${booking.id}`}
      telegramBotUsername={telegramBotUsername}
      canCancel={canCancel}
      onCancel={() => cancelBookingFn({ data: { bookingId: booking.id } })}
      canStart={canStart}
      onStart={() => startBookingFn({ data: { bookingId: booking.id } })}
    />
  )
}
