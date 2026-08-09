import { queryOptions } from '@tanstack/react-query'
import { getAllAlbumsFn, getAlbumFn, getMyAlbumsFn } from './functions'
import type { AlbumFilter, AlbumSummary, AlbumDetail } from './types'

export function albumsEmptyResponse(): AlbumSummary[] {
  return []
}

export const albumQueries = {
  all: ['albums'] as const,
  mine: (filter: AlbumFilter = 'all') =>
    queryOptions({
      queryKey: [...albumQueries.all, 'mine', filter],
      staleTime: 30_000,
      queryFn: async (): Promise<AlbumSummary[]> =>
        (await getMyAlbumsFn({ data: filter })) ?? albumsEmptyResponse(),
    }),
  manage: () =>
    queryOptions({
      queryKey: [...albumQueries.all, 'manage'],
      staleTime: 30_000,
      queryFn: async (): Promise<AlbumSummary[]> =>
        (await getAllAlbumsFn()) ?? albumsEmptyResponse(),
    }),
  detail: (albumId: string) =>
    queryOptions({
      queryKey: [...albumQueries.all, 'detail', albumId],
      staleTime: 15_000,
      queryFn: async (): Promise<AlbumDetail | null> =>
        (await getAlbumFn({ data: { albumId } })) ?? null,
    }),
}
