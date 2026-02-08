
import { getBookingColumns } from "./components/booking-columns"
import { BookingDataTable } from "./components/booking-data-table"
import { BookingWithEquipment } from "@/lib/booking/types"
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
  equipmentId?: number
  startDate?: string
  endDate?: string
  page: number
  limit: number
  sortBy: 'startTime' | 'endTime' | 'status' | 'createdAt' | 'equipment'
  sortOrder: 'asc' | 'desc'
}

interface PageProps {
  bookings: BookingWithEquipment[]
  pagination: Pagination
  filters: Filters
  telegramBotUsername: string
  isLoading?: boolean
}

export function Page({ bookings, pagination, filters, telegramBotUsername, isLoading = false }: PageProps) {
  const description = pagination.total > 0
    ? `You have ${pagination.total} booking${pagination.total === 1 ? '' : 's'}`
    : "No bookings found"

  const columns = getBookingColumns()

  return (
    <PageContainer>
      <PageHeader
        title="My Bookings"
        description={description}
      />
      <BookingDataTable
        data={bookings}
        pagination={pagination}
        filters={filters}
        columns={columns}
        telegramBotUsername={telegramBotUsername}
        isLoading={isLoading}
      />
    </PageContainer>
  )
}
