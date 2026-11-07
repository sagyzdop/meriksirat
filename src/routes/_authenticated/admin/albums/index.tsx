import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { albumQueries } from '@/lib/albums/queries'
import { AdminAlbumSearchSchema } from '@/lib/search-params'
import { Page } from '@/components/admin/albums'

export const Route = createFileRoute('/_authenticated/admin/albums/')({
  validateSearch: AdminAlbumSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    try {
      await context.queryClient.ensureQueryData(
        albumQueries.manage(deps.search)
      )
    } catch (error) {
      console.error('Failed to load albums:', error)
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, isFetching } = useQuery(albumQueries.manage(search))
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <Page
      albums={data?.albums ?? []}
      pagination={
        data?.pagination ?? {
          page: search.page,
          limit: search.limit,
          totalCount: 0,
          totalPages: 0,
        }
      }
      filters={search}
      isLoading={isRouterPending || isFetching}
      onFiltersChange={(patch) =>
        navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }
    />
  )
}
