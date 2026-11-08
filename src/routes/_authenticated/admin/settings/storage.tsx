import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Page } from '@/components/admin/settings/storage'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

export const Route = createFileRoute('/_authenticated/admin/settings/storage')({
  component: RouteComponent,
  validateSearch: z.object({
    buffer: z.string().optional(),
    buffer_error: z.string().optional(),
  }),
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
  const search = Route.useSearch()
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
      pool={pool}
      canEditCap={canEditCap}
      connected={search.buffer === 'connected'}
      connectError={search.buffer_error}
    />
  )
}
