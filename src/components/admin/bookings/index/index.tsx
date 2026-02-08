import { bookingColumns } from "./components/booking-columns"
import { BookingDataTable } from "./components/booking-data-table"
import type { AdminBookingWithDetails } from "@/lib/booking/types"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Filters {
  status?: string[]
  page: number
  limit: number
  sortBy: 'startTime' | 'endTime' | 'status' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface PageProps {
  bookings: AdminBookingWithDetails[]
  pagination: Pagination
  filters: Filters
  isLoading?: boolean
}

export function Page({ bookings, pagination, filters, isLoading = false }: PageProps) {
  const description = pagination.total > 0
    ? `Managing ${pagination.total} booking${pagination.total === 1 ? '' : 's'}`
    : "No bookings found"

  return (
    <PageContainer>
      <PageHeader
        title="Manage Bookings"
        description={description}
      />
      <BookingDataTable
        data={bookings}
        columns={bookingColumns}
        pagination={pagination}
        filters={filters}
        isLoading={isLoading}
      />
    </PageContainer>
  )
}
