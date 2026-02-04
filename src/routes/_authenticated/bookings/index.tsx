import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/bookings/index'
import { getUserBookingsFn, getTelegramBotUsernameFn } from '@/lib/booking'
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
          // Fall through to other treatments
        }
      }
      if (val.includes(',')) return val.split(',');
      return [val];
    }
    return val;
  }, z.array(z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue']))).optional(),
  equipmentId: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  sortBy: z.enum(['startTime', 'endTime', 'status', 'createdAt', 'equipment']).default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const Route = createFileRoute('/_authenticated/bookings/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const search = deps.search
    try {
      const [bookingsResponse, telegramBotUsername] = await Promise.all([
        getUserBookingsFn({ data: search }),
        getTelegramBotUsernameFn(),
      ])

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
        telegramBotUsername,
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
        telegramBotUsername: '',
      }
    }
  },
})

function RouteComponent() {
  const { bookings, pagination, telegramBotUsername } = Route.useLoaderData()
  const search = Route.useSearch()

  return (
    <Page
      bookings={bookings}
      pagination={pagination}
      filters={search}
      telegramBotUsername={telegramBotUsername}
    />
  )
}
