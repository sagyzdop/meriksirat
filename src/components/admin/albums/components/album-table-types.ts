import type { AdminAlbumRow } from '@/lib/albums/types'
import type { AlbumStatus } from '@/lib/albums/status'

export type AlbumBulkAction =
  | 'move-to-buffer'
  | 'move-to-flamekeeper'
  | 'schedule-deletion'
  | 'cancel-deletion'

export interface AlbumTableFilters {
  search?: string
  status?: AlbumStatus[]
  storage?: ('buffer' | 'flamekeeper')[]
  startDate?: string
  endDate?: string
  page: number
  limit: number
  sortBy: 'title' | 'eventDate' | 'createdAt' | 'photoCount' | 'photoBytes'
  sortOrder: 'asc' | 'desc'
}

export type OnBulkAction = (
  action: AlbumBulkAction,
  albums: AdminAlbumRow[]
) => void

export const OFFLOAD_ENABLED =
  import.meta.env.VITE_ENABLE_ALBUM_OFFLOAD === 'true'
