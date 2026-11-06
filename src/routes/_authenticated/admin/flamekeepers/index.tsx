import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { Page } from '@/components/admin/flamekeepers'
import { FLAMEKEEPER_SORT_KEYS } from '@/components/admin/flamekeepers/types'
import { flamekeeperQueries } from '@/lib/flamekeeper/queries'
import { stringArrayParam } from '@/lib/search-params'
import { USER_STATUSES } from '@/lib/user/types'

const searchSchema = z.object({
  search: z.string().optional(),
  status: stringArrayParam(z.enum(USER_STATUSES)),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sortBy: z.enum(FLAMEKEEPER_SORT_KEYS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const Route = createFileRoute('/_authenticated/admin/flamekeepers/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search: search.search }),
  loader: async ({ deps, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        flamekeeperQueries.adminList({ search: deps.search })
      )
    } catch (error) {
      console.error('[Flamekeepers Route Loader] Failed to load:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { user } = Route.useRouteContext()
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  const { data: rows = [], isFetching } = useQuery(
    flamekeeperQueries.adminList({ search: search.search })
  )

  return (
    <Page
      rows={rows}
      filters={search}
      isLoading={isRouterPending || isFetching}
      canBan={user.role === 'admin'}
      viewerId={user.id}
    />
  )
}
