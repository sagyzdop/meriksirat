import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/settings/storage'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute('/_authenticated/admin/settings/storage')({
  component: RouteComponent,
  loader: async ({ context }) => {
    const tasks: Promise<unknown>[] = [
      context.queryClient.ensureQueryData(adminDashboardQueries.buffer()),
    ]
    if (context.adminUser?.role === 'admin') {
      tasks.push(
        context.queryClient.ensureQueryData(adminDashboardQueries.pool())
      )
    }
    try {
      await Promise.all(tasks)
    } catch (error) {
      console.error('[Settings Storage Loader] Failed to load:', error)
    }
  },
})

function RouteComponent() {
  const { adminUser } = Route.useRouteContext()
  const canEditCap = adminUser?.role === 'admin'
  const { data: buffer, isFetching: bufferFetching } = useQuery(
    adminDashboardQueries.buffer()
  )
  const { data: pool } = useQuery({
    ...adminDashboardQueries.pool(),
    enabled: canEditCap,
  })

  return (
    <Page
      buffer={buffer}
      bufferLoading={bufferFetching && buffer === undefined}
      capBytes={pool?.capBytes}
      canEditCap={canEditCap}
    />
  )
}
