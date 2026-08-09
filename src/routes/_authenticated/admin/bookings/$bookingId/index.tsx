import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { Page } from "@/components/admin/bookings/$bookingId";
import { getAdminBookingByIdFn, getTelegramBotUsernameFn } from "@/lib/booking";
import { z } from "zod";
import { LoadingOverlay } from "@/components/shared/loading-overlay";

const BookingDetailSearchSchema = z.object({
  bookingId: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/bookings/$bookingId/")({
  component: RouteComponent,
  validateSearch: BookingDetailSearchSchema,
  loader: async ({ params }) => {
    const bookingId = parseInt(params.bookingId || "0");

    if (!bookingId || Number.isNaN(bookingId)) {
      throw new Error("Invalid booking ID");
    }

    try {
      const booking = await getAdminBookingByIdFn({ data: { bookingId } });

      if (!booking) {
        throw new Error("Booking not found");
      }

      let telegramBotUsername = "";
      try {
        telegramBotUsername = await getTelegramBotUsernameFn();
      } catch (error) {
        console.error("Failed to load telegram bot username:", error);
      }

      return { booking, telegramBotUsername };
    } catch (error) {
      console.error("Failed to load booking:", error);
      throw error;
    }
  },
});

function RouteComponent() {
  const { booking, telegramBotUsername } = Route.useLoaderData();
  const isLoading = useRouterState({ select: (state) => state.status === "pending" });

  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page booking={booking} telegramBotUsername={telegramBotUsername} />
    </div>
  );
}
