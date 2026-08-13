import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'

import {
  BookingCollapsibleContent,
  BookingCollapsibleList,
} from '@/components/shared/booking-collapsible'
import { CancelBookingDialog } from './components/cancel-booking-dialog'
import { cancelBookingFn } from '@/lib/booking'
import type { BookingWithItems } from '@/lib/booking/types'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'

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
  bookings: BookingWithItems[]
  pagination: Pagination
  filters: Filters
  telegramBotUsername: string
  currentUserName: string
  isLoading?: boolean
}

const statusOptions = [
  { value: 'booked', label: 'Booked' },
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'partially_returned', label: 'Partially Returned' },
]

export function Page({
  bookings,
  pagination,
  filters,
  telegramBotUsername,
  currentUserName,
  isLoading = false,
}: PageProps) {
  const navigate = useNavigate()
  const [cancelTarget, setCancelTarget] =
    React.useState<BookingWithItems | null>(null)

  const description =
    pagination.total > 0
      ? `You have ${pagination.total} booking${pagination.total === 1 ? '' : 's'}`
      : 'No bookings found'

  return (
    <PageContainer>
      <PageHeader title="My Bookings" description={description} />
      <BookingCollapsibleList
        bookings={bookings}
        pagination={pagination}
        filters={filters}
        statusOptions={statusOptions}
        telegramBotUsername={telegramBotUsername}
        isLoading={isLoading}
        calendarActionText="remove their calendar events"
        isCancellable={(status) => status === 'booked'}
        bulkCancelFn={(bookingId) => cancelBookingFn({ data: { bookingId } })}
        getDisplayName={() => currentUserName}
        onSortChange={(sortBy, sortOrder) =>
          navigate({
            to: '.',
            search: {
              ...filters,
              sortBy: sortBy as Filters['sortBy'],
              sortOrder,
              page: 1,
            },
          })
        }
        onStatusFilterChange={(status) =>
          navigate({
            to: '.',
            search: { ...filters, status, page: 1 },
          })
        }
        onResetFilters={() =>
          navigate({
            to: '.',
            search: {
              page: 1,
              limit: filters.limit,
              sortBy: 'startTime',
              sortOrder: 'desc',
            },
          })
        }
        onPageChange={(page) =>
          navigate({ to: '.', search: { ...filters, page } })
        }
        onPageSizeChange={(limit) =>
          navigate({ to: '.', search: { ...filters, limit, page: 1 } })
        }
        renderCollapsibleContent={(booking) => (
          <BookingCollapsibleContent
            booking={booking}
            telegramBotUsername={telegramBotUsername}
            onViewDetails={() =>
              navigate({
                to: '/bookings/$bookingId',
                params: { bookingId: booking.id.toString() },
              })
            }
            onEdit={() =>
              navigate({
                to: '/bookings/$bookingId/edit',
                params: { bookingId: booking.id.toString() },
              })
            }
            onCancel={
              booking.status === 'booked'
                ? () => setCancelTarget(booking)
                : undefined
            }
          />
        )}
      />

      <CancelBookingDialog
        booking={cancelTarget}
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
      />
    </PageContainer>
  )
}
