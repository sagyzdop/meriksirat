import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  ExternalLink,
  Flame,
  HardDrive,
  Images,
  Pencil,
  Trash2,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/page-header'
import { AlbumStatusBadge } from '@/components/albums/album-status-badge'
import { AlbumStorageBadge } from '@/components/albums/album-storage-badge'
import { EditAlbumDialog } from '@/components/albums/edit-album-dialog'
import type { AlbumFormValues } from '@/components/albums/album-form-fields'
import { albumQueries } from '@/lib/albums/queries'
import { updateAlbumFn } from '@/lib/albums/functions'
import { formatUtcDate, toDateOnlyString } from '@/lib/format'
import { errorMessage } from '@/lib/utils'
import type { AdminAlbumRow, AlbumDetail } from '@/lib/albums/types'
import { AlbumStorageCell } from '../components/album-columns'
import { OFFLOAD_ENABLED } from '../components/album-table-types'
import { useAlbumBulkActions } from '../components/use-album-bulk-actions'
import { AlbumAuthorsTable } from './components/album-authors-table'
import { AlbumOverview } from './components/album-overview'

interface PageProps {
  albumId: string
}

function toRow(
  album: AlbumDetail,
  photoBytes: number,
  ownerEmail: string | null
): AdminAlbumRow {
  return {
    id: album.id,
    title: album.title,
    description: album.description,
    event: album.event,
    eventDate: album.eventDate,
    ownerUserId: album.ownerUserId,
    ownerName: album.authors[0]?.name ?? null,
    ownerEmail,
    photoCount: album.photos.length,
    photoBytes,
    createdAt: album.createdAt,
    rescuedAt: album.rescuedAt,
    scheduledDeletionAt: album.scheduledDeletionAt,
    storage: album.storage,
  }
}

export function Page({ albumId }: PageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const { data: album, isLoading } = useQuery(albumQueries.detail(albumId))
  const { data: authors = [] } = useQuery(albumQueries.authors(albumId))

  const { onBulkAction, dialogs } = useAlbumBulkActions()

  const goBack = () =>
    navigate({
      to: '/admin/albums',
      search: { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' },
    })

  if (isLoading && !album) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!album || album.tombstone) {
    return (
      <div className="space-y-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images />
            </EmptyMedia>
            <EmptyTitle>Album not found</EmptyTitle>
            <EmptyDescription>
              This album does not exist or has been deleted.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="secondary" onClick={goBack}>
            Back to albums
          </Button>
        </Empty>
      </div>
    )
  }

  const photoBytes = album.photos.reduce((n, p) => n + (p.size ?? 0), 0)
  const owner = authors.find((a) => a.authorRole === 'owner')
  const row = toRow(album, photoBytes, owner?.email ?? null)
  const ownerName = owner?.name ?? album.authors[0]?.name ?? 'Unknown'

  const handleSave = async (values: AlbumFormValues) => {
    if (!values.eventDate) return
    setSaving(true)
    try {
      await updateAlbumFn({
        data: {
          albumId,
          title: values.title.trim(),
          description: values.description.trim() || '',
          event: values.event.trim(),
          eventDate: toDateOnlyString(values.eventDate),
        },
      })
      toast.success('Album updated')
      setEditOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['albums'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ])
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update album'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title={album.title}
        description={album.event || undefined}
        onBack={goBack}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <a
                href={`/albums/${album.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                View public album
              </a>
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </Button>
          </div>
        }
      />

      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4" />
          {formatUtcDate(album.eventDate)}
        </span>
        <span aria-hidden="true">·</span>
        <span>Owner {ownerName}</span>
        <span aria-hidden="true">·</span>
        <span>Created {formatUtcDate(album.createdAt)}</span>
        <AlbumStatusBadge
          rescuedAt={album.rescuedAt}
          scheduledDeletionAt={album.scheduledDeletionAt}
        />
        {album.storage.holder === 'none' ? (
          <AlbumStorageCell album={row} />
        ) : (
          <AlbumStorageBadge storage={album.storage} />
        )}
        {album.scheduledDeletionAt && (
          <span>Deletes {formatUtcDate(album.scheduledDeletionAt)}</span>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {album.scheduledDeletionAt ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkAction('cancel-deletion', [row])}
          >
            <Undo2 />
            Cancel deletion
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onBulkAction('schedule-deletion', [row])}
          >
            <Trash2 />
            Schedule for deletion
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBulkAction('move-to-buffer', [row])}
        >
          <HardDrive />
          Move to Buffer
        </Button>
        {OFFLOAD_ENABLED && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkAction('move-to-flamekeeper', [row])}
          >
            <Flame />
            Move to Flamekeepers
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="authors">Authors</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <AlbumOverview album={album} photoBytes={photoBytes} />
        </TabsContent>
        <TabsContent value="authors">
          <AlbumAuthorsTable authors={authors} />
        </TabsContent>
      </Tabs>

      <EditAlbumDialog
        album={album}
        open={editOpen}
        onOpenChange={setEditOpen}
        busy={saving}
        onSave={handleSave}
      />
      {dialogs}
    </>
  )
}
