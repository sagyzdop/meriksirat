import * as React from 'react'
import { Plus, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import type { AlbumListFilters, AlbumSummary } from '@/lib/albums'
import { AlbumToolbar } from './album-toolbar'
import { CreateAlbumDialog } from './create-album-dialog'
import { InfiniteAlbumGroupedList } from './album-sections'

interface AlbumsPageProps {
  mode: 'mine' | 'manage'
  albums: AlbumSummary[]
  filters: AlbumListFilters
  onFiltersChange: (next: Partial<AlbumListFilters>) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  canCreate?: boolean
  onCreated?: () => void
  headerActions?: React.ReactNode
}

export function AlbumsPage({
  mode,
  albums,
  filters,
  onFiltersChange,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  canCreate = true,
  onCreated,
  headerActions,
}: AlbumsPageProps) {
  const [createOpen, setCreateOpen] = React.useState(false)

  return (
    <PageContainer>
      <PageHeader
        title={mode === 'manage' ? 'Manage Albums' : 'My Albums'}
        description="Photo albums backed by Google Drive."
        actions={
          mode === 'manage' ? (
            headerActions
          ) : (
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={!canCreate}
              title={
                canCreate
                  ? undefined
                  : 'Album creation requires clearance level 3'
              }
            >
              <Plus />
              New album
            </Button>
          )
        }
      />

      <AlbumToolbar filters={filters} onFiltersChange={onFiltersChange} />

      {albums.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images />
            </EmptyMedia>
            <EmptyTitle>
              {mode === 'manage' ? 'No albums yet' : 'No albums here'}
            </EmptyTitle>
            <EmptyDescription>
              {mode === 'manage'
                ? 'All albums across the club appear here.'
                : !filters.search && filters.ownership.length === 0
                  ? 'Create your first album to start sharing photos.'
                  : 'No albums match your search and filters.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <InfiniteAlbumGroupedList
          albums={albums}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        />
      )}

      <CreateAlbumDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onCreated}
      />
    </PageContainer>
  )
}
