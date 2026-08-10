import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { ALBUM_CREATE_MIN_CLEARANCE, albumQueries } from '@/lib/albums'
import { AlbumListFiltersSchema } from '@/lib/albums'
import type { AlbumListFilters } from '@/lib/albums'
import { AlbumsPage } from '@/components/albums/albums-page'

export const Route = createFileRoute('/_authenticated/my-albums/')({
  validateSearch: AlbumListFiltersSchema,
  loaderDeps: ({ search }) => ({ filters: search }),
  loader: async ({ context, deps }) => {
    const queryClient = context.queryClient
    try {
      await queryClient.ensureInfiniteQueryData({
        ...albumQueries.mine(deps.filters),
        revalidateIfStale: true,
      })
    } catch (error) {
      console.error('Failed to load albums:', error)
    }
  },
  component: MyAlbumsIndex,
})

function MyAlbumsIndex() {
  const navigate = useNavigate({ from: '/my-albums/' })
  const search = Route.useSearch()
  const queryClient = useQueryClient()
  const { user } = Route.useRouteContext()

  const canCreate = (user?.clearanceLevel ?? 0) >= ALBUM_CREATE_MIN_CLEARANCE

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(albumQueries.mine(search))

  const albums = React.useMemo(
    () => data?.pages.flatMap((page) => page.albums) ?? [],
    [data]
  )

  const handleFiltersChange = (next: Partial<AlbumListFilters>) => {
    navigate({ search: (prev) => ({ ...prev, ...next }) })
  }

  const handleCreated = () => {
    queryClient.invalidateQueries({
      queryKey: albumQueries.all,
      refetchType: 'all',
    })
    navigate({
      search: { search: '', ownership: 'all', visibility: 'all' },
    })
  }

  return (
    <AlbumsPage
      mode="mine"
      albums={albums}
      filters={search}
      onFiltersChange={handleFiltersChange}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      canCreate={canCreate}
      onCreated={handleCreated}
    />
  )
}
