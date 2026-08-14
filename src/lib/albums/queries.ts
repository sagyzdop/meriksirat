import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import {
  getAllAlbumsFn,
  getAlbumFn,
  getMyAlbumsFn,
  getPublicAlbumsFn,
} from './functions'
import type {
  AlbumDetail,
  AlbumListFilters,
  AlbumListPage,
  AlbumOwnershipFilter,
  AlbumSummary,
  AlbumVisibilityFilter,
} from './types'

export function albumsEmptyResponse(): AlbumSummary[] {
  return []
}

function emptyPage(): AlbumListPage {
  return { albums: [], nextCursor: null }
}

export interface AlbumListQueryInput {
  search?: string
  ownership?: AlbumOwnershipFilter[]
  visibility?: AlbumVisibilityFilter[]
}

export function normalizeFilters(
  filters: AlbumListQueryInput
): AlbumListFilters {
  return {
    search: filters.search ?? '',
    ownership: filters.ownership ?? [],
    visibility: filters.visibility ?? [],
  }
}

export const albumQueries = {
  all: ['albums'] as const,
  mine: (filters: AlbumListQueryInput = {}) =>
    infiniteQueryOptions({
      queryKey: [...albumQueries.all, 'mine', normalizeFilters(filters)],
      // Always considered stale so the list refetches on every visit and on
      // window focus — album lists must never linger on old data.
      staleTime: 0,
      refetchOnWindowFocus: true,
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }): Promise<AlbumListPage> =>
        (await getMyAlbumsFn({ data: { ...filters, cursor: pageParam } })) ??
        emptyPage(),
      getNextPageParam: (last) => last.nextCursor,
    }),
  public: (filters: AlbumListQueryInput = {}) =>
    infiniteQueryOptions({
      queryKey: [...albumQueries.all, 'public', normalizeFilters(filters)],
      staleTime: 0,
      refetchOnWindowFocus: true,
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }): Promise<AlbumListPage> =>
        (await getPublicAlbumsFn({
          data: { ...filters, cursor: pageParam },
        })) ?? emptyPage(),
      getNextPageParam: (last) => last.nextCursor,
    }),
  manage: (filters: AlbumListQueryInput = {}) =>
    infiniteQueryOptions({
      queryKey: [...albumQueries.all, 'manage', normalizeFilters(filters)],
      staleTime: 0,
      refetchOnWindowFocus: true,
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }): Promise<AlbumListPage> =>
        (await getAllAlbumsFn({ data: { ...filters, cursor: pageParam } })) ??
        emptyPage(),
      getNextPageParam: (last) => last.nextCursor,
    }),
  detail: (albumId: string) =>
    queryOptions({
      queryKey: [...albumQueries.all, 'detail', albumId],
      staleTime: 15_000,
      queryFn: async (): Promise<AlbumDetail | null> =>
        (await getAlbumFn({ data: { albumId } })) ?? null,
    }),
}
