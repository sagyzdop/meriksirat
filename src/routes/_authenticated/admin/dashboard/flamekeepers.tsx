import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/dashboard/flamekeepers'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute(
  '/_authenticated/admin/dashboard/flamekeepers'
)({
  component: RouteComponent,
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(
        adminDashboardQueries.flamekeepers()
      )
    } catch (error) {
      console.error(
        '[Dashboard flamekeepers Loader] Failed to load stats:',
        error
      )
    }
  },
})

function RouteComponent() {
  const { data: stats, isFetching } = useQuery(
    adminDashboardQueries.flamekeepers()
  )

  return <Page stats={stats} statsLoading={isFetching && !stats} />
}
