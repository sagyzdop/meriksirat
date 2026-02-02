import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/bookings/index'
import { getAdminBookingsFn } from '@/lib/booking/functions/admin-bookings'
import { z } from 'zod'

const searchSchema = z.object({
  status: z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue']).optional(),
  userId: z.string().optional(),
  equipmentId: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
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
  
  return (
    <Page 
      bookings={bookings} 
      pagination={pagination}
      filters={search}
    />
  )
}
