import { BookingDetail } from '@/components/shared/booking-detail'
import { cancelBookingFn, returnBookingFn, startBookingFn } from '@/lib/booking'
import { useAddBookingItems } from '@/hooks/use-add-booking-items'
import type { BookingInfoTableBookedBy } from '@/components/shared/booking-info-table'
import type { BookingWithItems } from '@/lib/booking/types'

interface PageProps {
  booking: BookingWithItems
  telegramBotUsername: string
  bookedBy?: BookingInfoTableBookedBy | null
}

export function Page({ booking, telegramBotUsername, bookedBy }: PageProps) {
  const now = new Date()
  const canCancel = booking.status === 'booked'
  const canReturn =
    booking.status === 'active' ||
    booking.status === 'partially_returned' ||
    booking.status === 'overdue'
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
      bookedBy={bookedBy}
      canAddEquipment={booking.status === 'booked'}
      returnTo={`/bookings/${booking.id}`}
      telegramBotUsername={telegramBotUsername}
      canCancel={canCancel}
      onCancel={() => cancelBookingFn({ data: { bookingId: booking.id } })}
      canReturn={canReturn}
      onReturn={() => returnBookingFn({ data: { bookingId: booking.id } })}
      canStart={canStart}
      onStart={() => startBookingFn({ data: { bookingId: booking.id } })}
    />
  )
}
