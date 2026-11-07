import { createFileRoute, retainSearchParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Page } from '@/components/admin/dashboard/bookings'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

const searchSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const Route = createFileRoute(
  '/_authenticated/admin/dashboard/bookings'
)({
  component: RouteComponent,
  validateSearch: searchSchema,
  search: { middlewares: [retainSearchParams(['startDate', 'endDate'])] },
  loaderDeps: ({ search }) => ({
    startDate: search.startDate,
    endDate: search.endDate,
  }),
  loader: async ({ deps, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        adminDashboardQueries.bookings(deps)
      )
    } catch (error) {
      console.error('[Dashboard bookings Loader] Failed to load stats:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: stats, isFetching } = useQuery(
    adminDashboardQueries.bookings(search)
  )

  return (
    <Page
      search={search}
      onRangeChange={(range) =>
        navigate({
          search: { startDate: range.startDate, endDate: range.endDate },
        })
      }
      stats={stats}
      statsLoading={isFetching && !stats}
    />
  )
}
