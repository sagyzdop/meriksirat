// PROTOTYPE ROUTE: dedicated flamekeepers admin screen. The route hosts three
// switchable layouts; the loader already fetches the data each of them needs.
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { Page } from '@/components/admin/flamekeepers'
import {
  FLAMEKEEPER_SORT_KEYS,
  FLAMEKEEPER_VARIANTS,
} from '@/components/admin/flamekeepers/types'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import { flamekeeperQueries } from '@/lib/flamekeeper/queries'
import { stringArrayParam } from '@/lib/search-params'
import { USER_STATUSES } from '@/lib/user/types'

const searchSchema = z.object({
  search: z.string().optional(),
  status: stringArrayParam(z.enum(USER_STATUSES)),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(FLAMEKEEPER_SORT_KEYS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  variant: z.enum(FLAMEKEEPER_VARIANTS).default('A'),
})

export const Route = createFileRoute('/_authenticated/admin/flamekeepers/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loader: async ({ context }) => {
    const tasks: Promise<unknown>[] = [
      context.queryClient.ensureQueryData(flamekeeperQueries.adminList({})),
      context.queryClient.ensureQueryData(adminDashboardQueries.pool()),
    ]
    if (context.adminUser?.role === 'admin') {
      tasks.push(
        context.queryClient.ensureQueryData(adminDashboardQueries.freeSpace())
      )
    }

    try {
      await Promise.all(tasks)
    } catch (error) {
      console.error('[Flamekeepers Route Loader] Failed to load:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { user, adminUser } = Route.useRouteContext()

  const { data: rows = [], isFetching: isListFetching } = useQuery(
    flamekeeperQueries.adminList({})
  )
  const { data: pool, isFetching: isPoolFetching } = useQuery(
    adminDashboardQueries.pool()
  )
  const canManageOffload = adminUser?.role === 'admin'
  const { data: suggestions, isFetching: isOffloadFetching } = useQuery({
    ...adminDashboardQueries.freeSpace(),
    enabled: canManageOffload,
  })

  return (
    <Page
      rows={rows}
      filters={search}
      pool={pool}
      poolLoading={isPoolFetching && !pool}
      suggestions={suggestions}
      offloadLoading={isOffloadFetching && !suggestions}
      canEditCap={user.role === 'admin'}
      canManageOffload={canManageOffload}
      canBan={user.role === 'admin'}
      viewerId={user.id}
      isLoading={isListFetching && rows.length === 0}
    />
  )
}
