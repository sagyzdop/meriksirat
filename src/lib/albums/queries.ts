import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
} from '@tanstack/react-query'
import {
  getAllAlbumsFn,
  getAlbumAuthorsFn,
  getAlbumFn,
  getMyAlbumsFn,
  getPhotoDetailsFn,
  getPublicAlbumsFn,
} from './functions'
import type {
  AdminAlbumListInput,
  AdminAlbumListResponse,
  AlbumAuthorRow,
  AlbumDetail,
  AlbumListFilters,
  AlbumListPage,
  AlbumPhotoDetails,
  AlbumOwnershipFilter,
} from './types'

export interface AlbumListQueryInput {
  search?: string
  ownership?: AlbumOwnershipFilter[]
}

function normalizeFilters(filters: AlbumListQueryInput): AlbumListFilters {
  return {
    search: filters.search ?? '',
    ownership: filters.ownership ?? [],
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
      placeholderData: keepPreviousData,
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }): Promise<AlbumListPage> =>
        await getMyAlbumsFn({ data: { ...filters, cursor: pageParam } }),
      getNextPageParam: (last) => last.nextCursor,
    }),
  public: (filters: AlbumListQueryInput = {}) =>
    infiniteQueryOptions({
      queryKey: [...albumQueries.all, 'public', normalizeFilters(filters)],
      staleTime: 0,
      refetchOnWindowFocus: true,
      placeholderData: keepPreviousData,
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }): Promise<AlbumListPage> =>
        await getPublicAlbumsFn({
          data: { ...filters, cursor: pageParam },
        }),
      getNextPageParam: (last) => last.nextCursor,
    }),
  manage: (filters: AdminAlbumListInput = {}) =>
    queryOptions({
      queryKey: [...albumQueries.all, 'manage', filters],
      staleTime: 0,
      refetchOnWindowFocus: true,
      queryFn: async (): Promise<AdminAlbumListResponse> =>
        await getAllAlbumsFn({ data: filters }),
    }),
  authors: (albumId: string) =>
    queryOptions({
      queryKey: [...albumQueries.all, 'authors', albumId],
      staleTime: 0,
      queryFn: async (): Promise<AlbumAuthorRow[]> =>
        await getAlbumAuthorsFn({ data: { albumId } }),
    }),
  detail: (albumId: string) =>
    queryOptions({
      queryKey: [...albumQueries.all, 'detail', albumId],
      staleTime: 15_000,
      queryFn: async (): Promise<AlbumDetail | null> =>
        (await getAlbumFn({ data: { albumId } })) ?? null,
    }),
  photoDetails: (albumId: string, fileId: string) =>
    queryOptions({
      queryKey: [...albumQueries.all, 'photo', albumId, fileId],
      staleTime: Infinity,
      queryFn: async (): Promise<AlbumPhotoDetails | null> =>
        (await getPhotoDetailsFn({ data: { albumId, fileId } })) ?? null,
    }),
}
