import { bookingColumns } from "./components/booking-columns"
import { BookingDataTable } from "./components/booking-data-table"
import type { AdminBookingWithDetails } from "@/lib/booking/types"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { Link } from "@tanstack/react-router"

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
  const description = pagination.total > 0 
    ? `Managing ${pagination.total} booking${pagination.total === 1 ? '' : 's'}`
    : "No bookings found"

  return (
    <PageContainer>
      <PageHeader 
        title="Manage Bookings"
        description={description}
        actions={
          <Button asChild>
            <Link to="/admin/bookings/new">
              <Plus className="mr-2 h-4 w-4" />
              New Booking
            </Link>
          </Button>
        }
      />
      <BookingDataTable 
        data={bookings} 
        columns={bookingColumns} 
        pagination={pagination}
        filters={filters}
      />
    </PageContainer>
  )
}
