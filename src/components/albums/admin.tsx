import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { albumQueries } from '@/lib/albums'
import type { AlbumListFilters } from '@/lib/albums'
import { AlbumsPage } from '@/components/albums/albums-page'

interface AdminAlbumsProps {
  search: AlbumListFilters
}

export function AdminAlbums({ search }: AdminAlbumsProps) {
  const navigate = useNavigate()

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(albumQueries.manage(search))

  const albums = React.useMemo(
    () => data?.pages.flatMap((page) => page.albums) ?? [],
    [data]
  )

  const handleFiltersChange = (next: Partial<AlbumListFilters>) => {
    navigate({
      to: '/admin/albums',
      search: (prev) => ({ ...prev, ...next }),
    })
  }

  return (
    <AlbumsPage
      mode="manage"
      albums={albums}
      filters={search}
      onFiltersChange={handleFiltersChange}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      onCreated={() => {}}
    />
  )
}
