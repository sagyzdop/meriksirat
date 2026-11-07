import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/dashboard/storage'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute('/_authenticated/admin/dashboard/storage')(
  {
    component: RouteComponent,
    loader: async ({ context }) => {
      try {
        await context.queryClient.ensureQueryData(
          adminDashboardQueries.storage()
        )
      } catch (error) {
        console.error('[Dashboard storage Loader] Failed to load stats:', error)
      }
    },
  }
)

function RouteComponent() {
  const { data: stats, isFetching } = useQuery(adminDashboardQueries.storage())

  return <Page stats={stats} statsLoading={isFetching && !stats} />
}
