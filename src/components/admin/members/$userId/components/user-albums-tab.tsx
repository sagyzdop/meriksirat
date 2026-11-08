import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlbumDataTable } from '@/components/admin/albums/components/album-data-table'
import { useAlbumBulkActions } from '@/components/admin/albums/components/use-album-bulk-actions'
import type { AlbumTableFilters } from '@/components/admin/albums/components/album-table-types'
import type { AdminUserAlbum } from '@/lib/admin/dashboard-types'
import type { PaginationMeta } from '@/lib/pagination'

export interface AlbumSearch {
  albumSearch?: string
  albumStatus?: AlbumTableFilters['status']
  albumStorage?: AlbumTableFilters['storage']
  albumStartDate?: string
  albumEndDate?: string
  albumPage: number
  albumLimit: number
  albumSortBy: AlbumTableFilters['sortBy']
  albumSortOrder: 'asc' | 'desc'
}

interface UserAlbumsTabProps {
  albums: AdminUserAlbum[]
  pagination: PaginationMeta
  search: AlbumSearch
  isLoading?: boolean
}

const keyMap = {
  search: 'albumSearch',
  status: 'albumStatus',
  storage: 'albumStorage',
  startDate: 'albumStartDate',
  endDate: 'albumEndDate',
  page: 'albumPage',
  limit: 'albumLimit',
  sortBy: 'albumSortBy',
  sortOrder: 'albumSortOrder',
} as const

export function UserAlbumsTab({
  albums,
  pagination,
  search,
  isLoading = false,
}: UserAlbumsTabProps) {
  const navigate = useNavigate()
  const { onBulkAction, dialogs, resetToken } = useAlbumBulkActions()

  const filters = React.useMemo<AlbumTableFilters>(
    () => ({
      search: search.albumSearch,
      status: search.albumStatus,
      storage: search.albumStorage,
      startDate: search.albumStartDate,
      endDate: search.albumEndDate,
      page: search.albumPage,
      limit: search.albumLimit,
      sortBy: search.albumSortBy,
      sortOrder: search.albumSortOrder,
    }),
    [search]
  )

  const handleFiltersChange = React.useCallback(
    (patch: Partial<AlbumTableFilters>) => {
      const mapped: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(patch)) {
        mapped[keyMap[key as keyof typeof keyMap]] = value
      }
      navigate({ to: '.', search: { ...search, ...mapped } as never })
    },
    [search, navigate]
  )

  return (
    <>
      <AlbumDataTable
        albums={albums}
        pagination={pagination}
        filters={filters}
        isLoading={isLoading}
        selectionResetToken={resetToken}
        onBulkAction={onBulkAction}
        onFiltersChange={handleFiltersChange}
      />
      {dialogs}
    </>
  )
}
