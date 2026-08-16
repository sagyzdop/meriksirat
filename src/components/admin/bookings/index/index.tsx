import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  BookingCollapsibleContent,
  BookingCollapsibleList,
} from '@/components/shared/booking-collapsible'
import { CancelBookingDialog } from '@/components/admin/bookings/$bookingId.edit/components/cancel-booking-dialog'
import { updateBookingStatusAdminFn } from '@/lib/booking'
import type { AdminBookingWithDetails } from '@/lib/booking/types'
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
  startDate?: string
  endDate?: string
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

const statusOptions = [
  { value: 'booked', label: 'Booked' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'partially_returned', label: 'Partially Returned' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function Page({
  bookings,
  pagination,
  filters,
  isLoading = false,
}: PageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [cancelTarget, setCancelTarget] =
    React.useState<AdminBookingWithDetails | null>(null)

  const description =
    pagination.total > 0
      ? `Managing ${pagination.total} booking${pagination.total === 1 ? '' : 's'}`
      : 'No bookings found'

  const getDisplayName = (booking: AdminBookingWithDetails) => {
    if (!booking.user) return 'Unknown User'
    const name =
      `${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim()
    return name || booking.user.email || 'Unknown User'
  }

  return (
    <PageContainer>
      <PageHeader title="Manage Bookings" description={description} />
      <BookingCollapsibleList
        bookings={bookings}
        pagination={pagination}
        filters={filters}
        statusOptions={statusOptions}
        showOverdueBanner
        isLoading={isLoading}
        calendarActionText="update their calendar events"
        isCancellable={(status) => status === 'booked'}
        bulkCancelFn={(bookingId) =>
          updateBookingStatusAdminFn({
            data: { bookingId, status: 'cancelled' },
          })
        }
        getDisplayName={getDisplayName}
        getPersonInfo={(booking) => ({
          name: getDisplayName(booking),
          image: booking.user?.image,
          href: booking.user ? `/admin/users/${booking.user.id}` : undefined,
        })}
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
        onDateFilterChange={(range) =>
          navigate({
            to: '.',
            search: {
              ...filters,
              startDate: range?.from ? range.from.toISOString() : undefined,
              endDate: range?.to ? range.to.toISOString() : undefined,
              page: 1,
            },
          })
        }
        onResetFilters={() =>
          navigate({
            to: '.',
            search: {
              page: 1,
              limit: filters.limit,
              sortBy: 'startTime',
              sortOrder: 'asc',
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
            onViewDetails={() =>
              navigate({
                to: '/admin/bookings/$bookingId',
                params: { bookingId: booking.id.toString() },
              })
            }
            onEdit={() =>
              navigate({
                to: '/admin/bookings/$bookingId/edit',
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
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
        bookingId={cancelTarget?.id ?? 0}
        onCancelled={() => {
          setCancelTarget(null)
          queryClient.invalidateQueries({ queryKey: ['bookings'] })
        }}
        onError={(message) => toast.error(message)}
      />
    </PageContainer>
  )
}
