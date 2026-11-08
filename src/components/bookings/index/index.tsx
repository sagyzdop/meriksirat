import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'

import {
  BookingCollapsibleContent,
  BookingCollapsibleList,
} from '@/components/shared/booking-collapsible'
import { CancelBookingDialog } from './components/cancel-booking-dialog'
import { cancelBookingFn } from '@/lib/booking'
import { BOOKING_STATUS_OPTIONS } from '@/lib/booking/types'
import type { BookingFilters, BookingWithItems } from '@/lib/booking/types'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import type { PageInfo } from '@/lib/pagination'

interface PageProps {
  bookings: BookingWithItems[]
  pagination: PageInfo
  filters: BookingFilters
  telegramBotUsername: string
  currentUserName: string
  currentUserImage?: string | null
  isLoading?: boolean
}

export function Page({
  bookings,
  pagination,
  filters,
  telegramBotUsername,
  currentUserName,
  currentUserImage,
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
        statusOptions={BOOKING_STATUS_OPTIONS}
        isLoading={isLoading}
        calendarActionText="remove their calendar events"
        isCancellable={(status) => status === 'booked'}
        bulkCancelFn={(bookingId) => cancelBookingFn({ data: { bookingId } })}
        getDisplayName={() => currentUserName}
        getPersonInfo={() => ({
          name: currentUserName,
          image: currentUserImage,
          href: '/account',
        })}
        onSortChange={(sortBy, sortOrder) =>
          navigate({
            to: '.',
            search: {
              ...filters,
              sortBy: sortBy as BookingFilters['sortBy'],
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
