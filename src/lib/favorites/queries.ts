import { queryOptions } from '@tanstack/react-query'
import {
  getAlbumFavoritesFn,
  listHeartedAlbumIdsFn,
  listHeartedAlbumsFn,
  listMyFavoritesFn,
} from './functions'
import type { FavoriteRef } from './logic'
import type { AlbumSummary } from '@/lib/albums/types'
import type { FavoritePhoto } from './types'

export const favoriteQueries = {
  all: ['favorites'] as const,
  mine: () =>
    queryOptions({
      queryKey: [...favoriteQueries.all, 'mine'],
      staleTime: 0,
      queryFn: async (): Promise<FavoritePhoto[]> => await listMyFavoritesFn(),
    }),
  album: (albumId: string) =>
    queryOptions({
      queryKey: [...favoriteQueries.all, 'album', albumId],
      staleTime: 30_000,
      queryFn: async (): Promise<FavoriteRef[]> =>
        await getAlbumFavoritesFn({ data: { albumId } }),
    }),
  heartedAlbums: () =>
    queryOptions({
      queryKey: [...favoriteQueries.all, 'albums', 'mine'],
      staleTime: 0,
      queryFn: async (): Promise<AlbumSummary[]> => await listHeartedAlbumsFn(),
    }),
  heartedAlbumIds: () =>
    queryOptions({
      queryKey: [...favoriteQueries.all, 'albums', 'ids'],
      staleTime: 30_000,
      queryFn: async (): Promise<string[]> => await listHeartedAlbumIdsFn(),
    }),
}
