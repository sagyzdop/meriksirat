import { BookingDetail } from "@/components/shared/booking-detail";
import { updateBookingStatusAdminFn } from "@/lib/booking";
import type { AdminBookingWithDetails } from "@/lib/booking/types";

interface PageProps {
  booking: AdminBookingWithDetails;
  telegramBotUsername?: string;
}

export function Page({ booking, telegramBotUsername }: PageProps) {
  const canCancel =
    booking.status !== "returned" && booking.status !== "cancelled";

  return (
    <BookingDetail
      booking={booking}
      backTo="/admin/bookings"
      backLabel="Back to Bookings"
      editTo="/admin/bookings/$bookingId/edit"
      userDetails={
        booking.user
          ? {
              name:
                `${booking.user.firstName ?? ""} ${booking.user.lastName ?? ""}`.trim() ||
                "Unknown",
              email: booking.user.email,
            }
          : null
      }
      cancelDescription="Are you sure you want to cancel this booking? This action cannot be undone and the calendar event will be updated."
      canCancel={canCancel}
      onCancel={() =>
        updateBookingStatusAdminFn({
          data: { bookingId: booking.id, status: "cancelled" },
        })
      }
      telegramBotUsername={telegramBotUsername}
    />
  );
}
