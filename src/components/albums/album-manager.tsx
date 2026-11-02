import * as React from 'react'
import {
  TriangleAlert,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  Upload,
  X,
  LogOut,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toDateOnlyString } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { UploadDropzone } from './upload-dropzone'
import { ShareDialog } from './share-dialog'
import { EditAlbumDialog } from './edit-album-dialog'
import type { AlbumFormValues } from './album-form-fields'
import { useAsyncAction } from '@/hooks/use-async-action'
import {
  deleteAlbumFn,
  recreateAlbumFolderFn,
  refreshAlbumFn,
  removeMemberFn,
  restoreAlbumFolderFn,
  updateAlbumFn,
} from '@/lib/albums'
import type { AlbumDetail } from '@/lib/albums'
import { recreateSummary } from '@/lib/albums/recreate'
import { clearUploadReveal, useUploadReveal } from '@/lib/albums/upload-manager'

interface AlbumManagerProps {
  album: AlbumDetail
  currentUserId?: string
  onChanged: () => void
  onDeleted: () => void
}

export function AlbumManager({
  album,
  currentUserId,
  onChanged,
  onDeleted,
}: AlbumManagerProps) {
  const [showUpload, setShowUpload] = React.useState(false)
  const [shareOpen, setShareOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [leaveOpen, setLeaveOpen] = React.useState(false)
  const [recreateOpen, setRecreateOpen] = React.useState(false)
  const { pending: busy, run: runBusy } = useAsyncAction()
  const { pending: recreating, run: runRecreate } = useAsyncAction()
  const { pending: restoring, run: runRestore } = useAsyncAction()
  const { pending: refreshing, run: runRefresh } = useAsyncAction()
  const { pending: removePending, run: runRemove } = useAsyncAction()
  const [removingId, setRemovingId] = React.useState<string | null>(null)
  const removing = removePending ? removingId : null
  const reveal = useUploadReveal()

  React.useEffect(() => {
    if (reveal.albumId === album.id && reveal.nonce > 0) {
      setShowUpload(true)
      clearUploadReveal()
    }
  }, [reveal, album.id])

  const isManager = album.access === 'owner' || album.access === 'manager'
  const isSelfMember =
    !!currentUserId &&
    album.access === 'editor' &&
    album.authors.some((a) => a.id === currentUserId)

  const handleUpdate = (values: AlbumFormValues) =>
    runBusy(async () => {
      await updateAlbumFn({
        data: {
          albumId: album.id,
          title: values.title.trim(),
          description: values.description.trim() || '',
          event: values.event.trim(),
          eventDate: values.eventDate
            ? toDateOnlyString(values.eventDate)
            : undefined,
        },
      })
      toast.success('Album updated')
      setEditOpen(false)
      onChanged()
    }, 'Failed to update album')

  const handleDelete = () =>
    runBusy(async () => {
      await deleteAlbumFn({ data: { albumId: album.id } })
      toast.success('Album deleted')
      setDeleteOpen(false)
      onDeleted()
    }, 'Failed to delete album')

  const handleLeave = () => {
    if (!currentUserId) return
    return runBusy(async () => {
      await removeMemberFn({
        data: { albumId: album.id, userId: currentUserId },
      })
      toast.success('You left the album')
      setLeaveOpen(false)
      onDeleted()
    }, 'Failed to leave album')
  }

  const handleRecreate = () =>
    runRecreate(async () => {
      const result = await recreateAlbumFolderFn({
        data: { albumId: album.id },
      })
      toast.success(recreateSummary(result))
      setRecreateOpen(false)
      onChanged()
    }, 'Failed to recreate folder')

  const handleRestore = () =>
    runRestore(async () => {
      await restoreAlbumFolderFn({ data: { albumId: album.id } })
      toast.success('Album folder restored')
      onChanged()
    }, 'Failed to restore folder')

  const handleRefresh = () =>
    runRefresh(async () => {
      await refreshAlbumFn({ data: { albumId: album.id } })
      toast.success('Album refreshed')
      onChanged()
    }, 'Failed to refresh album')

  const handleRemoveMember = (userId: string) => {
    setRemovingId(userId)
    return runRemove(async () => {
      await removeMemberFn({ data: { albumId: album.id, userId } })
      toast.success('Co-author removed')
      onChanged()
    }, 'Failed to remove member')
  }

  const folderMissing = album.folderState === 'missing'
  const folderTrashed = album.folderState === 'trashed'

  return (
    <div className="space-y-4">
      {folderMissing && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Album folder deleted from Google Drive</AlertTitle>
          <AlertDescription>
            The folder behind this album was permanently deleted. Photos that
            flamekeepers uploaded may still be in their Google Drives. You can
            recreate an empty folder to keep uploading, which permanently
            deletes those photos, or delete the album.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={recreating}
              onClick={() => setRecreateOpen(true)}
            >
              {recreating ? (
                <Loader2 className="animate-spin" />
              ) : (
                <TriangleAlert />
              )}
              Recreate folder
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {folderTrashed && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Album folder is in the Google Drive bin</AlertTitle>
          <AlertDescription>
            The folder behind this album was moved to the bin in Drive. Uploads
            are paused until it is restored.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={restoring}
              onClick={handleRestore}
            >
              {restoring ? (
                <Loader2 className="animate-spin" />
              ) : (
                <TriangleAlert />
              )}
              Restore folder
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="flex flex-col gap-2 sm:min-w-0 sm:flex-1 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start sm:w-auto"
            onClick={() => setShowUpload((s) => !s)}
            disabled={album.folderState !== 'ok'}
            title={
              album.folderState === 'trashed'
                ? 'Restore the album folder from the Drive bin before uploading'
                : album.folderState === 'missing'
                  ? 'Recreate the album folder before uploading'
                  : undefined
            }
          >
            {showUpload ? <X /> : <Upload />}
            {showUpload ? 'Hide upload' : 'Upload photos'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start sm:w-auto"
            onClick={() => setShareOpen(true)}
          >
            <Share2 />
            Share
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start sm:w-auto"
            onClick={() => setEditOpen(true)}
          >
            <Pencil />
            Edit details
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start sm:w-auto"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Refresh
          </Button>
          {isManager && (
            <Button
              type="button"
              variant="destructive"
              className="w-full justify-start sm:w-auto"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Delete album
            </Button>
          )}
          {isSelfMember && (
            <Button
              type="button"
              variant="destructive"
              className="w-full justify-start sm:w-auto"
              onClick={() => setLeaveOpen(true)}
            >
              <LogOut />
              Leave album
            </Button>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadDropzone
          albumId={album.id}
          albumTitle={album.title}
          existingNames={album.photos.map((p) => p.name)}
          onUploaded={onChanged}
        />
      )}

      <div>
        <Label className="mb-2 block text-xs text-muted-foreground uppercase">
          Authors
        </Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {album.authors.map((author) => {
            const isOwner = author.id === album.ownerUserId
            const isSelf = author.id === currentUserId
            return (
              <Badge key={author.id} variant="secondary" className="gap-1 py-1">
                {author.name}
                {!isOwner && !isSelf && isManager && (
                  <button
                    type="button"
                    disabled={removing === author.id}
                    onClick={() => handleRemoveMember(author.id)}
                    className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    aria-label={`Remove ${author.name}`}
                  >
                    {removing === author.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <X className="size-3" />
                    )}
                  </button>
                )}
              </Badge>
            )
          })}
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        album={album}
        onChanged={onChanged}
      />

      <EditAlbumDialog
        album={album}
        open={editOpen}
        onOpenChange={setEditOpen}
        busy={busy}
        onSave={handleUpdate}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete album?</DialogTitle>
            <DialogDescription>
              This permanently deletes the album, all its photos from Google
              Drive, and removes all co-authors. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={busy}
            >
              {busy ? 'Deleting...' : 'Delete album'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recreateOpen} onOpenChange={setRecreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recreate folder?</DialogTitle>
            <DialogDescription>
              Any photos from this album that are still in the Google Drives of
              flamekeepers will be permanently deleted and cannot be recovered.
              The album will restart empty with a new folder.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRecreateOpen(false)}
              disabled={recreating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRecreate}
              disabled={recreating}
            >
              {recreating && <Loader2 className="animate-spin" />}
              {recreating ? 'Deleting...' : 'Delete photos and recreate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave album?</DialogTitle>
            <DialogDescription>
              You will no longer be a co-author of &quot;{album.title}&quot; and
              will lose upload and edit access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLeaveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleLeave}
              disabled={busy}
            >
              {busy ? 'Leaving...' : 'Leave album'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
