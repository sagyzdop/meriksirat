import { bookingColumns } from "./components/booking-columns"
import { BookingDataTable } from "./components/booking-data-table"
import type { AdminBookingWithDetails } from "@/lib/booking/types"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Filters {
  status?: 'booked' | 'active' | 'returned' | 'cancelled' | 'overdue'
  userId?: string
  equipmentId?: number
  startDate?: string
  endDate?: string
  search?: string
  page: number
  limit: number
  sortBy: 'startTime' | 'endTime' | 'status' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface PageProps {
  bookings: AdminBookingWithDetails[]
  pagination: Pagination
  filters: Filters
}

export function Page({ bookings, pagination, filters }: PageProps) {
  return (
    <div className="h-full flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8 md:flex">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Booking Oversight</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {pagination.total > 0 
              ? `Managing ${pagination.total} booking${pagination.total === 1 ? '' : 's'}`
              : "No bookings found"
            }
          </p>
        </div>
      </div>
      <BookingDataTable 
        data={bookings} 
        columns={bookingColumns} 
        pagination={pagination}
        filters={filters}
      />
    </div>
  )
}
