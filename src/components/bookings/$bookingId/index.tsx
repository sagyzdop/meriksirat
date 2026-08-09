import { BookingDetail } from "@/components/shared/booking-detail";
import { cancelBookingFn } from "@/lib/booking";
import type { BookingWithItems } from "@/lib/booking/types";

interface PageProps {
  booking: BookingWithItems;
  telegramBotUsername?: string;
}

export function Page({ booking, telegramBotUsername }: PageProps) {
  const canCancel = booking.status === "booked" || booking.status === "active";

  return (
    <BookingDetail
      booking={booking}
      backTo="/bookings"
      backLabel="Back to Bookings"
      editTo="/bookings/$bookingId/edit"
      canCancel={canCancel}
      onCancel={() => cancelBookingFn({ data: { bookingId: booking.id } })}
      telegramBotUsername={telegramBotUsername}
    />
  );
}
