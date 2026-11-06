import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/storage'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute('/_authenticated/admin/storage')({
  component: RouteComponent,
  loader: async ({ context }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(adminDashboardQueries.buffer()),
        context.queryClient.ensureQueryData(adminDashboardQueries.pool()),
      ])
    } catch (error) {
      console.error('[Storage Route Loader] Failed to load storage:', error)
    }
  },
})

function RouteComponent() {
  const { adminUser } = Route.useRouteContext()
  const { data: buffer, isFetching: isBufferFetching } = useQuery(
    adminDashboardQueries.buffer()
  )
  const { data: pool, isFetching: isPoolFetching } = useQuery(
    adminDashboardQueries.pool()
  )

  return (
    <Page
      buffer={buffer}
      bufferLoading={isBufferFetching && buffer === undefined}
      pool={pool}
      poolLoading={isPoolFetching && !pool}
      canEditCap={adminUser?.role === 'admin'}
    />
  )
}
