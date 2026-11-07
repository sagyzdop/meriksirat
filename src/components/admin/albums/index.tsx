import { AlbumDataTable } from './components/album-data-table'
import { useAlbumBulkActions } from './components/use-album-bulk-actions'
import type { AlbumTableFilters } from './components/album-table-types'
import type { AdminAlbumRow } from '@/lib/albums/types'
import type { PaginationMeta } from '@/lib/pagination'

interface PageProps {
  albums: AdminAlbumRow[]
  pagination: PaginationMeta
  filters: AlbumTableFilters
  isLoading?: boolean
  onFiltersChange: (patch: Partial<AlbumTableFilters>) => void
}

export function Page({
  albums,
  pagination,
  filters,
  isLoading = false,
  onFiltersChange,
}: PageProps) {
  const { onBulkAction, dialogs, resetToken } = useAlbumBulkActions()

  return (
    <>
      <AlbumDataTable
        albums={albums}
        pagination={pagination}
        filters={filters}
        isLoading={isLoading}
        selectionResetToken={resetToken}
        onBulkAction={onBulkAction}
        onFiltersChange={onFiltersChange}
      />
      {dialogs}
    </>
  )
}
