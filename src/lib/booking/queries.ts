import { queryOptions } from '@tanstack/react-query'
import { getUserBookingsFn } from './functions/user-bookings'
import { getAdminBookingsFn } from './functions/admin-bookings'
import { getBookingItemEquipmentIdsFn } from './functions/booking-items'
import type {
  BookingFilters,
  AdminBookingFilters,
  PaginatedBookingsResponse,
  PaginatedAdminBookingsResponse,
} from './types'
import { DEFAULT_BOOKING_STATUS_FILTER } from './types'

/**
 * Applies the default status filter (Booked, Active, Overdue, Partially
 * Returned) when no explicit status was chosen, so returned/cancelled bookings
 * stay hidden unless the user opts in via the status filter.
 */
export function normalizeBookingFilters<
  T extends { status?: readonly string[] },
>(filters: T): T {
  if (filters.status && filters.status.length > 0) return filters
  return { ...filters, status: [...DEFAULT_BOOKING_STATUS_FILTER] }
}

export function bookingsEmptyResponse(
  filters: BookingFilters
): PaginatedBookingsResponse {
  return {
    data: [],
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  }
}

export function adminBookingsEmptyResponse(
  filters: AdminBookingFilters
): PaginatedAdminBookingsResponse {
  return {
    data: [],
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  }
}

export const bookingsQueries = {
  all: ['bookings'] as const,
  lists: () => ['bookings', 'list'] as const,
  adminLists: () => ['bookings', 'admin-list'] as const,
  mine: (filters: BookingFilters) =>
    queryOptions({
      queryKey: [...bookingsQueries.lists(), filters],
      queryFn: async (): Promise<PaginatedBookingsResponse> =>
        (await getUserBookingsFn({ data: filters })) ??
        bookingsEmptyResponse(filters),
    }),
  adminList: (filters: AdminBookingFilters) =>
    queryOptions({
      queryKey: [...bookingsQueries.adminLists(), filters],
      queryFn: async (): Promise<PaginatedAdminBookingsResponse> =>
        (await getAdminBookingsFn({ data: filters })) ??
        adminBookingsEmptyResponse(filters),
    }),
  bookingItemEquipmentIds: (bookingId?: number) =>
    queryOptions({
      queryKey: [...bookingsQueries.all, 'item-equipment-ids', bookingId ?? -1],
      queryFn: async () => {
        if (bookingId === undefined) return []
        const result = await getBookingItemEquipmentIdsFn({
          data: { bookingId },
        })
        return result?.equipmentIds ?? []
      },
      enabled: bookingId !== undefined,
    }),
}
