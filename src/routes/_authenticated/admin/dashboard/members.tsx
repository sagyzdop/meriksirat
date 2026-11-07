import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/dashboard/members'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute('/_authenticated/admin/dashboard/members')(
  {
    component: RouteComponent,
    loader: async ({ context }) => {
      try {
        await context.queryClient.ensureQueryData(
          adminDashboardQueries.members()
        )
      } catch (error) {
        console.error('[Dashboard members Loader] Failed to load stats:', error)
      }
    },
  }
)

function RouteComponent() {
  const { data: stats, isFetching } = useQuery(adminDashboardQueries.members())

  return <Page stats={stats} statsLoading={isFetching && !stats} />
}
