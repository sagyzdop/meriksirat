import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/settings'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: RouteComponent,
  loader: async ({ context }) => {
    try {
      const tasks: Promise<unknown>[] = [
        context.queryClient.ensureQueryData(adminDashboardQueries.settings()),
      ]
      if (context.adminUser?.role === 'admin') {
        tasks.push(
          context.queryClient.ensureQueryData(adminDashboardQueries.clubCode())
        )
      }
      await Promise.all(tasks)
    } catch (error) {
      console.error('[Settings Route Loader] Failed to load settings:', error)
    }
  },
})

function RouteComponent() {
  const { adminUser } = Route.useRouteContext()
  const { data: settings, isFetching: isSettingsFetching } = useQuery(
    adminDashboardQueries.settings()
  )
  const { data: clubCode } = useQuery({
    ...adminDashboardQueries.clubCode(),
    enabled: adminUser?.role === 'admin',
  })

  return (
    <Page
      settings={settings}
      settingsLoading={isSettingsFetching && !settings}
      clubCode={clubCode}
      canBroadcast={adminUser?.role === 'admin'}
    />
  )
}
