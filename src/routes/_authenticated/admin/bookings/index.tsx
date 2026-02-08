import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { Page } from '@/components/admin/bookings/index'
import { getAdminBookingsFn } from '@/lib/booking/functions/admin-bookings'
import { z } from 'zod'

const searchSchema = z.object({
  status: z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      if (val === '') return undefined;
      // Handle stringified JSON arrays
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          // Fall through
        }
      }
      if (val.includes(',')) return val.split(',');
      return [val];
    }
    return val;
  }, z.array(z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue']))).optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  sortBy: z.enum(['startTime', 'endTime', 'status', 'createdAt']).default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const Route = createFileRoute('/_authenticated/admin/bookings/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const search = deps.search
    try {
      const bookingsResponse = await getAdminBookingsFn({ data: search })
      return {
        bookings: bookingsResponse?.data || [],
        pagination: bookingsResponse?.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      }
    } catch (error) {
      console.error('Failed to load bookings:', error)
      return {
        bookings: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      }
    }
  },
})

function RouteComponent() {
  const { bookings, pagination } = Route.useLoaderData()
  const search = Route.useSearch()
  const isLoading = useRouterState({ select: (state) => state.status === 'pending' })

  return (
    <Page
      bookings={bookings}
      pagination={pagination}
      filters={search}
      isLoading={isLoading}
    />
  )
}
