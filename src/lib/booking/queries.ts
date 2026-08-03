import { queryOptions } from '@tanstack/react-query'
import { getUserBookingsFn } from './functions/user-bookings'
import { getAdminBookingsFn } from './functions/admin-bookings'
import type {
  BookingFilters,
  AdminBookingFilters,
  PaginatedBookingsResponse,
  PaginatedAdminBookingsResponse,
} from './types'

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
}
