import * as React from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { albumQueries } from '@/lib/albums'

export function useAlbumList(options: ReturnType<typeof albumQueries.mine>) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(options)
  const albums = React.useMemo(
    () => data?.pages.flatMap((page) => page.albums) ?? [],
    [data]
  )
  return { albums, hasNextPage, isFetchingNextPage, fetchNextPage }
}
