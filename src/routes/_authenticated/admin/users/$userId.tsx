import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { getAdminUserByIdFn } from '@/lib/user'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import { stringArrayParam } from '@/lib/search-params'
import { Page } from '@/components/admin/users/$userId'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import type { AdminUserAlbumsFilters } from '@/lib/admin/dashboard-types'

const searchSchema = z.object({
  albumSearch: z.string().optional(),
  albumVisibility: stringArrayParam(z.enum(['public', 'private'])),
  albumPage: z.coerce.number().min(1).default(1),
  albumLimit: z.coerce.number().min(1).max(100).default(10),
  albumSortBy: z
    .enum(['title', 'isShared', 'createdAt', 'coAuthorCount'])
    .default('createdAt'),
  albumSortOrder: z.enum(['asc', 'desc']).default('desc'),
})

type UserDetailSearch = z.infer<typeof searchSchema>

function userAlbumsFilters(
  userId: string,
  search: UserDetailSearch
): AdminUserAlbumsFilters {
  return {
    userId,
    search: search.albumSearch,
    visibility: search.albumVisibility,
    page: search.albumPage,
    limit: search.albumLimit,
    sortBy: search.albumSortBy,
    sortOrder: search.albumSortOrder,
  }
}

export const Route = createFileRoute('/_authenticated/admin/users/$userId')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    const userId = params.userId
    if (!userId) {
      throw new Error('User ID is required')
    }

    try {
      const user = await getAdminUserByIdFn({ data: { userId } })

      if (!user) {
        throw new Error('User not found')
      }

      return { user }
    } catch (error) {
      console.error('Failed to load user:', error)
      throw new Error('Failed to load user data')
    }
  },
})

function RouteComponent() {
  const { user } = Route.useLoaderData()
  const search = Route.useSearch()
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  const { data: albumsResponse, isFetching } = useQuery(
    adminDashboardQueries.userAlbums(userAlbumsFilters(user.id, search))
  )

  return (
    <div className="relative">
      {isRouterPending && <LoadingOverlay />}
      <Page
        user={user}
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
