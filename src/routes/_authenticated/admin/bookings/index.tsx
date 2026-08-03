import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/bookings/index'
import { bookingsQueries, adminBookingsEmptyResponse } from '@/lib/booking'
import { z } from 'zod'

const searchSchema = z.object({
  status: z
    .preprocess(
      (val) => {
        if (Array.isArray(val)) return val
        if (typeof val === 'string') {
          if (val === '') return undefined
          // Handle stringified JSON arrays
          if (val.startsWith('[') && val.endsWith(']')) {
            try {
              const parsed = JSON.parse(val)
              if (Array.isArray(parsed)) return parsed
            } catch (e) {
              // Fall through
            }
          }
          if (val.includes(',')) return val.split(',')
          return [val]
        }
        return val
      },
      z.array(z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue']))
    )
    .optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z
    .enum(['startTime', 'endTime', 'status', 'createdAt'])
    .default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const Route = createFileRoute('/_authenticated/admin/bookings/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        bookingsQueries.adminList(deps.search)
      )
    } catch (error) {
      console.error('Failed to load bookings:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { data, isFetching } = useQuery(bookingsQueries.adminList(search))
  const response = data ?? adminBookingsEmptyResponse(search)
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <Page
      bookings={response.data}
      pagination={response.pagination}
      filters={search}
      isLoading={isRouterPending || isFetching}
    />
  )
}
