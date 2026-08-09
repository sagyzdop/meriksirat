import * as React from 'react'
import { Plus, Loader2, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { toast } from 'sonner'
import { createAlbumFn } from '@/lib/albums'
import type { AlbumListFilters, AlbumSummary } from '@/lib/albums'
import { AlbumToolbar } from './album-toolbar'
import { InfiniteAlbumGroupedList } from './album-sections'

interface AlbumsPageProps {
  mode: 'mine' | 'manage'
  albums: AlbumSummary[]
  filters: AlbumListFilters
  onFiltersChange: (next: Partial<AlbumListFilters>) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  showPrivacy?: boolean
  showOwnershipFilter?: boolean
  showVisibilityFilter?: boolean
  onCreated: () => void
}

export function AlbumsPage({
  mode,
  albums,
  filters,
  onFiltersChange,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  showPrivacy = true,
  showOwnershipFilter = true,
  showVisibilityFilter = true,
  onCreated,
}: AlbumsPageProps) {
  const [createOpen, setCreateOpen] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { id } = await createAlbumFn({
        data: { title: title.trim(), description: description.trim() || '' },
      })
      toast.success('Album created')
      setCreateOpen(false)
      setTitle('')
      setDescription('')
      onCreated()
      return id
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create album'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === 'manage' ? 'Manage Albums' : 'My Albums'}
        description="Photo albums backed by Google Drive."
        actions={
          mode === 'mine' && (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus />
              New album
            </Button>
          )
        }
      />

      <AlbumToolbar
        filters={filters}
        onFiltersChange={onFiltersChange}
        showOwnership={showOwnershipFilter}
        showVisibility={showVisibilityFilter}
      />

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
                : !filters.search &&
                    filters.ownership === 'all' &&
                    filters.visibility === 'all'
                  ? 'Create your first album to start sharing photos.'
                  : 'No albums match your search and filters.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <InfiniteAlbumGroupedList
          albums={albums}
          showPrivacy={showPrivacy}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New album</DialogTitle>
            <DialogDescription>
              Creates a photo folder in Google Drive.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-album-title">Title</Label>
              <Input
                id="new-album-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Tech Room Trip 2026"
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-album-description">Description</Label>
              <Textarea
                id="new-album-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                rows={3}
                maxLength={1000}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : <Plus />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
