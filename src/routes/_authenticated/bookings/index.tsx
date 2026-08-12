import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/bookings/index'
import {
  bookingsQueries,
  bookingsEmptyResponse,
  getTelegramBotUsernameFn,
} from '@/lib/booking'
import { z } from 'zod'
import { stringArrayParam } from '@/lib/search-params'

const searchSchema = z.object({
  status: stringArrayParam(
    z.enum([
      'booked',
      'active',
      'returned',
      'cancelled',
      'overdue',
      'partially_returned',
    ])
  ),
  equipmentId: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z
    .enum(['startTime', 'endTime', 'status', 'createdAt', 'equipment'])
    .default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const Route = createFileRoute('/_authenticated/bookings/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        bookingsQueries.mine(deps.search)
      )
    } catch (error) {
      console.error('Failed to load bookings:', error)
    }

    let telegramBotUsername = ''
    try {
      telegramBotUsername = await getTelegramBotUsernameFn()
    } catch (error) {
      console.error('Failed to load telegram bot username:', error)
    }

    return { telegramBotUsername }
  },
})

function RouteComponent() {
  const { telegramBotUsername } = Route.useLoaderData()
  const search = Route.useSearch()
  const { user } = Route.useRouteContext()
  const { data, isFetching } = useQuery(bookingsQueries.mine(search))
  const response = data ?? bookingsEmptyResponse(search)
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  const currentUserName =
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    user?.email ||
    'You'

  return (
    <Page
      bookings={response.data}
      pagination={response.pagination}
      filters={search}
      telegramBotUsername={telegramBotUsername}
      currentUserName={currentUserName}
      isLoading={isRouterPending || isFetching}
    />
  )
}
