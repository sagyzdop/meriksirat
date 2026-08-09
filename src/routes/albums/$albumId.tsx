import * as React from 'react'
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  Images,
  Link2,
  Lock,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { authClient } from '@/lib/auth/auth-client'
import {
  albumQueries,
  claimEditAccessFn,
  deletePhotoFn,
  setCoverPhotoFn,
} from '@/lib/albums'
import type { AlbumPhoto } from '@/lib/albums'
import { useUploads, revealUploadDetails } from '@/lib/albums/upload-manager'
import { formatUtcDate } from '@/lib/format'
import { AlbumManager } from '@/components/albums/album-manager'
import { PhotoGrid } from '@/components/albums/photo-grid'
import { toast } from 'sonner'

const searchSchema = z.object({
  edit: z.string().optional(),
})

export const Route = createFileRoute('/albums/$albumId')({
  validateSearch: searchSchema,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      albumQueries.detail(params.albumId)
    )
  },
  component: AlbumPage,
})

function AlbumPage() {
  const { albumId } = Route.useParams()
  const { edit } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const { data: album, isLoading } = useQuery(albumQueries.detail(albumId))

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: albumQueries.all })
    router.invalidate()
  }, [queryClient, router])

  React.useEffect(() => {
    if (!edit) return

    ;(async () => {
      try {
        if (!session?.user) {
          toast.error('Please log in to join this album')
          navigate({ to: '/login' })
          return
        }
        await claimEditAccessFn({ data: { albumId, token: edit } })
        toast.success('You are now a co-author of this album')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not join album'
        )
      } finally {
        navigate({
          to: '/albums/$albumId',
          params: { albumId },
          search: {},
          replace: true,
        })
        invalidate()
      }
    })()
  }, [edit, albumId, session?.user, navigate, invalidate])

  // Refresh once uploads queued for this album finish.
  const uploads = useUploads().filter((j) => j.albumId === albumId)
  const activeUploads = uploads.filter(
    (j) => j.status === 'queued' || j.status === 'uploading'
  )
  const doneUploads = uploads.filter((j) => j.status === 'done')
  const doneRef = React.useRef(doneUploads.length)
  React.useEffect(() => {
    if (
      uploads.length > 0 &&
      activeUploads.length === 0 &&
      doneUploads.length > doneRef.current
    ) {
      doneRef.current = doneUploads.length
      invalidate()
    }
  }, [activeUploads.length, doneUploads.length, uploads.length, invalidate])

  const isLoggedIn = mounted && !!session?.user
  const canManage = album ? album.access !== 'none' : false

  const overall =
    uploads.length === 0
      ? 0
      : Math.round((doneUploads.length / uploads.length) * 100)

  const handleSetCover = async (photo: AlbumPhoto) => {
    try {
      await setCoverPhotoFn({ data: { albumId, fileId: photo.id } })
      toast.success('Cover photo updated')
      invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to set cover'
      )
    }
  }

  const handleDeletePhoto = async (photo: AlbumPhoto) => {
    try {
      await deletePhotoFn({ data: { albumId, fileId: photo.id } })
      toast.success('Photo deleted')
      invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete photo'
      )
    }
  }

  const handleAlbumDeleted = () => {
    navigate({ to: '/albums', search: { filter: 'all' } })
  }

  if (isLoading && !album) {
    return (
      <PageContainer>
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-2 h-5 w-96" />
        <div className="mt-6 grid grid-cols-2 gap-px sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-none" />
          ))}
        </div>
      </PageContainer>
    )
  }

  if (!album) {
    return (
      <PageContainer>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images />
            </EmptyMedia>
            <EmptyTitle>Album not found</EmptyTitle>
            <EmptyDescription>
              This album does not exist or is not shared. Ask the owner to turn
              on the public view link.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title={album.title}
        description={album.description || undefined}
        backTo={isLoggedIn ? '/albums' : undefined}
        backLabel="Back to albums"
      />

      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        {album.isShared ? (
          <Badge variant="outline" className="gap-1">
            <Link2 className="size-3" />
            Public
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" />
            Private
          </Badge>
        )}
        <span className="flex items-center gap-1.5">
          <Users className="size-4" />
          {album.authors.map((a) => a.name).join(', ')}
        </span>
        <span aria-hidden="true">·</span>
        <span>Created {formatUtcDate(album.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <span>
          {album.photos.length} photo{album.photos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {canManage && (
        <div className="mb-6">
          <AlbumManager
            album={album}
            currentUserId={session?.user?.id}
            onChanged={invalidate}
            onDeleted={handleAlbumDeleted}
          />
        </div>
      )}

      <PhotoGrid
        photos={album.photos}
        canManage={canManage}
        onSetCover={canManage ? handleSetCover : undefined}
        onDeletePhoto={canManage ? handleDeletePhoto : undefined}
      />

      {activeUploads.length > 0 && (
        <button
          type="button"
          onClick={() => revealUploadDetails(albumId)}
          className="fixed inset-x-0 bottom-4 z-40 mx-auto w-full max-w-sm rounded-lg border bg-background p-3 text-left shadow-lg transition-colors hover:bg-muted"
          title="Open upload details"
        >
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Uploading photos…</span>
            <span>
              {doneUploads.length}/{uploads.length} · {overall}%
            </span>
          </div>
          <Progress value={overall} className="bg-primary/15" />
        </button>
      )}
    </PageContainer>
  )
}
