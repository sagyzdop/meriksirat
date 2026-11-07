import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/settings/members'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute('/_authenticated/admin/settings/members')({
  component: RouteComponent,
  loader: async ({ context }) => {
    if (context.adminUser?.role !== 'admin') return
    try {
      await context.queryClient.ensureQueryData(
        adminDashboardQueries.clubCode()
      )
    } catch (error) {
      console.error('[Settings Members Loader] Failed to load:', error)
    }
  },
})

function RouteComponent() {
  const { adminUser } = Route.useRouteContext()
  const canBroadcast = adminUser?.role === 'admin'
  const { data: clubCode } = useQuery({
    ...adminDashboardQueries.clubCode(),
    enabled: canBroadcast,
  })

  return <Page clubCode={clubCode} canBroadcast={canBroadcast} />
}
