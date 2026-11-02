import { useNavigate } from '@tanstack/react-router'
import { albumQueries } from '@/lib/albums'
import type { AlbumListFilters } from '@/lib/albums'
import { AlbumsPage } from '@/components/albums/albums-page'
import { useAlbumList } from '@/components/albums/use-album-list'
import { ExportAlbumsDialog } from '@/components/shared/export-albums-dialog'

interface AdminAlbumsProps {
  search: AlbumListFilters
}

export function AdminAlbums({ search }: AdminAlbumsProps) {
  const navigate = useNavigate()

  const { albums, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useAlbumList(albumQueries.manage(search))

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
      headerActions={<ExportAlbumsDialog />}
    />
  )
}
