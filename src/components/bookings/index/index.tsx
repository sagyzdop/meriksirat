
import { bookingColumns } from "./components/booking-columns"
import { BookingDataTable } from "./components/booking-data-table"
import { BookingWithEquipment } from "@/lib/booking/types"

interface PageProps {
  bookings: BookingWithEquipment[]
}

export function Page({ bookings }: PageProps) {
  return (
    <div className="h-full flex-1 flex-col gap-8 p-8 md:flex">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">My Bookings</h2>
          <p className="text-muted-foreground">
            {bookings.length > 0 
              ? `You have ${bookings.length} booking${bookings.length === 1 ? '' : 's'}`
              : "No bookings found"
            }
          </p>
        </div>
      </div>
      <BookingDataTable data={bookings} columns={bookingColumns} />
    </div>
  )
}
