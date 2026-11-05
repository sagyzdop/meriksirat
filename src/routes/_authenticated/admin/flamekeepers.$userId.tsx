// PROTOTYPE ROUTE: flamekeeper detail screen. The loader reuses the existing
// admin user loader and the cached flamekeeper list.
import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { getAdminUserByIdFn } from '@/lib/user'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import { flamekeeperQueries } from '@/lib/flamekeeper/queries'
import { Page } from '@/components/admin/flamekeepers/$userId'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import type { AdminUserAlbumsFilters } from '@/lib/admin/dashboard-types'

const searchSchema = z.object({
  albumSearch: z.string().optional(),
  albumPage: z.coerce.number().min(1).default(1),
  albumLimit: z.coerce.number().min(1).max(100).default(10),
  albumSortBy: z
    .enum(['title', 'createdAt', 'coAuthorCount'])
    .default('createdAt'),
  albumSortOrder: z.enum(['asc', 'desc']).default('desc'),
})

type FlamekeeperDetailSearch = z.infer<typeof searchSchema>

function albumsFilters(
  userId: string,
  search: FlamekeeperDetailSearch
): AdminUserAlbumsFilters {
  return {
    userId,
    search: search.albumSearch,
    page: search.albumPage,
    limit: search.albumLimit,
    sortBy: search.albumSortBy,
    sortOrder: search.albumSortOrder,
  }
}

export const Route = createFileRoute(
  '/_authenticated/admin/flamekeepers/$userId'
)({
  component: RouteComponent,
  validateSearch: searchSchema,
  loader: async ({ params, context }) => {
    const userId = params.userId
    if (!userId) throw new Error('User ID is required')

    try {
      const user = await getAdminUserByIdFn({ data: { userId } })
      await Promise.all([
        context.queryClient.ensureQueryData(flamekeeperQueries.adminList({})),
        context.queryClient.ensureQueryData(adminDashboardQueries.pool()),
      ])
      return { user: { ...user, birthday: user.birthday as string | null } }
    } catch (error) {
      console.error('Failed to load flamekeeper:', error)
      throw new Error('Failed to load flamekeeper data')
    }
  },
})

function RouteComponent() {
  const { user } = Route.useLoaderData()
  const { user: viewer } = Route.useRouteContext()
  const search = Route.useSearch()
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  const { data: flamekeepers } = useQuery(flamekeeperQueries.adminList({}))
  const { data: pool } = useQuery(adminDashboardQueries.pool())
  const { data: albumsResponse, isFetching } = useQuery(
    adminDashboardQueries.userAlbums(albumsFilters(user.id, search))
  )

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
        albums={albumsResponse?.albums ?? []}
        albumsPagination={
          albumsResponse?.pagination ?? {
            page: search.albumPage,
            limit: search.albumLimit,
            totalCount: 0,
            totalPages: 0,
          }
        }
        albumsSearch={search}
        albumsIsLoading={isRouterPending || isFetching}
      />
    </div>
  )
}
