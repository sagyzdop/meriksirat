import { BookingDetail } from '@/components/shared/booking-detail'
import { updateBookingStatusAdminFn } from '@/lib/booking'
import type { AdminBookingWithDetails } from '@/lib/booking/types'

interface PageProps {
  booking: AdminBookingWithDetails
}

export function Page({ booking }: PageProps) {
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
      backTo="/admin/bookings"
      backLabel="Back to Bookings"
      editTo="/admin/bookings/$bookingId/edit"
      bookedBy={bookedBy}
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
