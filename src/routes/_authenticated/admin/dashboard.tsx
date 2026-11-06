import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Page } from '@/components/admin/dashboard'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

const searchSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/admin/dashboard')({
  component: RouteComponent,
  pendingComponent: DashboardPending,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    startDate: search.startDate,
    endDate: search.endDate,
  }),
  loader: async ({ deps, context }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(
          adminDashboardQueries.stats({
            startDate: deps.startDate,
            endDate: deps.endDate,
          })
        ),
        context.queryClient.ensureQueryData(adminDashboardQueries.alerts()),
      ])
    } catch (error) {
      console.error('[Dashboard Route Loader] Failed to load dashboard:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { adminUser } = Route.useRouteContext()

  const { data: stats, isFetching: isStatsFetching } = useQuery(
    adminDashboardQueries.stats({
      startDate: search.startDate,
      endDate: search.endDate,
    })
  )
  const { data: alerts, isFetching: isAlertsFetching } = useQuery(
    adminDashboardQueries.alerts()
  )

  return (
    <Page
      search={search}
      stats={stats}
      statsLoading={isStatsFetching && !stats}
      alerts={alerts ?? []}
      alertsLoading={isAlertsFetching && !alerts}
      canBroadcast={adminUser?.role === 'admin'}
    />
  )
}

function DashboardPending() {
  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Bookings and album storage for the selected range"
      />
      <div className="max-w-2xl space-y-8">
        <div className="flex justify-end">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      </div>
    </PageContainer>
  )
}
