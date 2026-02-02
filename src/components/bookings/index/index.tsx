
import { bookingColumns } from "./components/booking-columns"
import { BookingDataTable } from "./components/booking-data-table"
import { BookingWithEquipment } from "@/lib/booking/types"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

interface PageProps {
  bookings: BookingWithEquipment[]
}

export function Page({ bookings }: PageProps) {
  const description = bookings.length > 0 
    ? `You have ${bookings.length} booking${bookings.length === 1 ? '' : 's'}`
    : "No bookings found"

  return (
    <PageContainer>
      <PageHeader 
        title="My Bookings"
        description={description}
      />
      <BookingDataTable data={bookings} columns={bookingColumns} />
    </PageContainer>
  )
}
