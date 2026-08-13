import { BookingDetail } from '@/components/shared/booking-detail'
import { updateBookingStatusAdminFn } from '@/lib/booking'
import { useAddBookingItems } from '@/hooks/use-add-booking-items'
import { useBackNavigation } from '@/hooks/use-back-navigation'
import type { AdminBookingWithDetails } from '@/lib/booking/types'

interface PageProps {
  booking: AdminBookingWithDetails
  telegramBotUsername: string
}

export function Page({ booking, telegramBotUsername }: PageProps) {
  const goBack = useBackNavigation('/admin/bookings')
  useAddBookingItems(booking.id)

  const canCancel =
    booking.status !== 'returned' && booking.status !== 'cancelled'

  const user = booking.user
  const bookedBy = user
    ? {
        id: user.id,
        name:
          `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
          user.email ||
          'Unknown',
        image: user.image,
      }
    : null

  return (
    <BookingDetail
      booking={booking}
      onBack={goBack}
      editTo="/admin/bookings/$bookingId/edit"
      bookedBy={bookedBy}
      canAddEquipment={booking.status === 'booked'}
      returnTo={`/admin/bookings/${booking.id}`}
      telegramBotUsername={telegramBotUsername}
      cancelDescription="Are you sure you want to cancel this booking? This action cannot be undone and the calendar event will be updated."
      canCancel={canCancel}
      onCancel={() =>
        updateBookingStatusAdminFn({
          data: { bookingId: booking.id, status: 'cancelled' },
        })
      }
    />
  )
}
