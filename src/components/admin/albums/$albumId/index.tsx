import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  Flame,
  FolderOpen,
  HardDrive,
  Images,
  Trash2,
  Undo2,
} from 'lucide-react'
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
import { AlbumManager } from '@/components/albums/album-manager'
import { AlbumStatusLegend } from '@/components/albums/album-status-legend'
import { albumQueries } from '@/lib/albums/queries'
import { driveFolderUrl } from '@/lib/albums/urls'
import type { AdminAlbumRow, AlbumDetail } from '@/lib/albums/types'
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
    status: album.status,
    storage: album.storage,
  }
}

export function Page({ albumId }: PageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['albums'], refetchType: 'all' })
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
  }

  return (
    <>
      <PageHeader
        title={album.title}
        onBack={goBack}
        actions={
          <div className="flex flex-wrap gap-2">
            {album.photos.length > 0 && (
              <Button asChild variant="secondary">
                <a
                  href={driveFolderUrl(album.driveFolderId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Opens this album's folder in Google Drive, where Drive's own Download button zips every photo"
                >
                  <FolderOpen />
                  Download
                </a>
              </Button>
            )}
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
          </div>
        }
      />

      <div className="mb-6">
        <AlbumManager
          album={album}
          isAdmin
          onChanged={invalidate}
          onRefreshed={(detail) => {
            queryClient.setQueryData(
              albumQueries.detail(albumId).queryKey,
              detail
            )
          }}
          onDeleted={() => {
            invalidate()
            goBack()
          }}
          extraActions={
            <>
              {album.scheduledDeletionAt ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start sm:w-auto"
                  onClick={() => onBulkAction('cancel-deletion', [row])}
                >
                  <Undo2 />
                  Cancel deletion
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full justify-start sm:w-auto"
                  onClick={() => onBulkAction('schedule-deletion', [row])}
                >
                  <Trash2 />
                  Schedule for deletion
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start sm:w-auto"
                onClick={() => onBulkAction('move-to-buffer', [row])}
              >
                <HardDrive />
                Move to Buffer
              </Button>
              {OFFLOAD_ENABLED && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start sm:w-auto"
                  onClick={() => onBulkAction('move-to-flamekeeper', [row])}
                >
                  <Flame />
                  Move to Flamekeepers
                </Button>
              )}
            </>
          }
        />
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="authors">Authors</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="space-y-6">
            <AlbumOverview
              album={album}
              photoBytes={photoBytes}
              ownerName={ownerName}
            />
            <AlbumStatusLegend />
          </div>
        </TabsContent>
        <TabsContent value="authors">
          <AlbumAuthorsTable authors={authors} />
        </TabsContent>
      </Tabs>

      {dialogs}
    </>
  )
}
