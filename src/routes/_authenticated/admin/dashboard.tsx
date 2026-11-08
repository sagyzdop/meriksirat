import { Outlet, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/dashboard'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute('/_authenticated/admin/dashboard')({
  component: RouteComponent,
  pendingComponent: DashboardPending,
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(adminDashboardQueries.alerts())
    } catch (error) {
      console.error('[Dashboard Route Loader] Failed to load alerts:', error)
    }
  },
})

function RouteComponent() {
  const { adminUser } = Route.useRouteContext()
  const { data: alerts, isFetching: isAlertsFetching } = useQuery(
    adminDashboardQueries.alerts()
  )

  return (
    <Page
      alerts={alerts ?? []}
      alertsLoading={isAlertsFetching && !alerts}
      canBroadcast={adminUser?.role === 'admin'}
    >
      <Outlet />
    </Page>
  )
}

function DashboardPending() {
  return (
    <PageContainer>
      <PageHeader title="Dashboard" />
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-9 w-80" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </PageContainer>
  )
}
