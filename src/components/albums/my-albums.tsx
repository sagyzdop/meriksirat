import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { ALBUM_CREATE_MIN_CLEARANCE, albumQueries } from '@/lib/albums'
import type { AlbumListFilters } from '@/lib/albums'
import type { UserProfile } from '@/lib/user/types'
import { AlbumsPage } from '@/components/albums/albums-page'

interface MyAlbumsIndexProps {
  user: UserProfile | null
  search: AlbumListFilters
}

export function MyAlbumsIndex({ user, search }: MyAlbumsIndexProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const canCreate = (user?.clearanceLevel ?? 0) >= ALBUM_CREATE_MIN_CLEARANCE

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(albumQueries.mine(search))

  const albums = React.useMemo(
    () => data?.pages.flatMap((page) => page.albums) ?? [],
    [data]
  )

  const handleFiltersChange = (next: Partial<AlbumListFilters>) => {
    navigate({
      to: '/my-albums',
      search: (prev) => ({ ...prev, ...next }),
    })
  }

  const handleCreated = () => {
    queryClient.invalidateQueries({
      queryKey: albumQueries.all,
      refetchType: 'all',
    })
    navigate({
      to: '/my-albums',
      search: { search: '', ownership: [], visibility: [] },
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
