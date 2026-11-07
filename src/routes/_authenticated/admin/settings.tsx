import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/settings'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: RouteComponent,
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(
        adminDashboardQueries.settings()
      )
    } catch (error) {
      console.error('[Settings Route Loader] Failed to load settings:', error)
    }
  },
})

function RouteComponent() {
  return (
    <Page>
      <Outlet />
    </Page>
  )
}
