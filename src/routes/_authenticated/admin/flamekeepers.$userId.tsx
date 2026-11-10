import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { getAdminUserByIdFn } from '@/lib/user'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import { flamekeeperQueries } from '@/lib/flamekeeper/queries'
import { Page } from '@/components/admin/flamekeepers/$userId'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { UserError } from '@/lib/user-error'

export const Route = createFileRoute(
  '/_authenticated/admin/flamekeepers/$userId'
)({
  component: RouteComponent,
  loader: async ({ params, context }) => {
    const userId = params.userId
    if (!userId) throw new UserError('User ID is required')

    try {
      const user = await getAdminUserByIdFn({ data: { userId } })
      await Promise.all([
        context.queryClient.ensureQueryData(
          flamekeeperQueries.adminList({ search: user.email })
        ),
        context.queryClient.ensureQueryData(adminDashboardQueries.pool()),
      ])
      return { user: { ...user, birthday: user.birthday as string | null } }
    } catch (error) {
      console.error('Failed to load flamekeeper:', error)
      throw new UserError('Failed to load flamekeeper data')
    }
  },
})

function RouteComponent() {
  const { user } = Route.useLoaderData()
  const { user: viewer } = Route.useRouteContext()
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  const { data: flamekeepers } = useQuery(
    flamekeeperQueries.adminList({ search: user.email })
  )
  const { data: pool } = useQuery(adminDashboardQueries.pool())

  const flamekeeper = flamekeepers?.find((row) => row.userId === user.id)

  return (
    <div className="relative">
      {isRouterPending && <LoadingOverlay />}
      <Page
        user={user}
        flamekeeper={flamekeeper}
        pool={pool}
        canBan={viewer.role === 'admin'}
        viewerId={viewer.id}
      />
    </div>
  )
}
