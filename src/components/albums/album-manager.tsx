import * as React from 'react'
import {
  Check,
  ExternalLink,
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
  acceptFewerPhotosFn,
  deleteAlbumFn,
  deleteGoneAlbumFn,
  refreshAlbumFn,
  removeMemberFn,
  updateAlbumFn,
} from '@/lib/albums'
import type { AlbumDetail } from '@/lib/albums'
import { folderWarning } from '@/lib/albums/folder-warning'
import { driveFolderUrl } from '@/lib/albums/urls'
import { clearUploadReveal, useUploadReveal } from '@/lib/albums/upload-manager'

interface AlbumManagerProps {
  album: AlbumDetail
  currentUserId?: string
  isAdmin?: boolean
  onChanged: () => void
  onDeleted: () => void
}

export function AlbumManager({
  album,
  currentUserId,
  isAdmin = false,
  onChanged,
  onDeleted,
}: AlbumManagerProps) {
  const [showUpload, setShowUpload] = React.useState(false)
  const [shareOpen, setShareOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [leaveOpen, setLeaveOpen] = React.useState(false)
  const [deleteGoneOpen, setDeleteGoneOpen] = React.useState(false)
  const { pending: busy, run: runBusy } = useAsyncAction()
  const { pending: deletingGone, run: runDeleteGone } = useAsyncAction()
  const { pending: refreshing, run: runRefresh } = useAsyncAction()
  const { pending: accepting, run: runAccept } = useAsyncAction()
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

  const handleDeleteGone = () =>
    runDeleteGone(async () => {
      await deleteGoneAlbumFn({ data: { albumId: album.id } })
      toast.success('Album deleted')
      setDeleteGoneOpen(false)
      onDeleted()
    }, 'Failed to delete album')

  const handleRefresh = () =>
    runRefresh(async () => {
      await refreshAlbumFn({ data: { albumId: album.id } })
      toast.success('Album refreshed')
      onChanged()
    }, 'Failed to refresh album')

  const handleAccept = (volumeKey: string) =>
    runAccept(async () => {
      await acceptFewerPhotosFn({ data: { albumId: album.id, volumeKey } })
      toast.success('New photo count accepted')
      onChanged()
    }, 'Failed to accept the new photo count')

  const handleRemoveMember = (userId: string) => {
    setRemovingId(userId)
    return runRemove(async () => {
      await removeMemberFn({ data: { albumId: album.id, userId } })
      toast.success('Co-author removed')
      onChanged()
    }, 'Failed to remove member')
  }

  const warning = folderWarning(album.folderState, { isAdmin })

  return (
    <div className="space-y-4">
      {warning && (
        <Alert
          variant={album.folderState === 'missing' ? 'destructive' : 'default'}
        >
          <TriangleAlert />
          <AlertTitle>{warning.title}</AlertTitle>
          <AlertDescription>
            {warning.description}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <a
                  href={driveFolderUrl(album.driveFolderId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink />
                  Open in Google Drive
                </a>
              </Button>
              {warning.canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletingGone}
                  onClick={() => setDeleteGoneOpen(true)}
                >
                  <Trash2 />
                  Delete album
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {album.countWarning?.volumes.map((v) => (
        <Alert key={v.key}>
          <TriangleAlert />
          <AlertTitle>Fewer photos than expected</AlertTitle>
          <AlertDescription>
            {v.listed.count} of {v.expected.count} photos found
            {v.admin
              ? ` (${v.admin.holder === 'buffer' ? 'buffer' : 'flamekeeper'} volume).`
              : '.'}{' '}
            Some files may have been removed from Google Drive. If you removed
            them on purpose, accept the new count.
            <div className="mt-2 flex flex-wrap gap-2">
              {v.admin && (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a
                    href={driveFolderUrl(v.admin.folderId)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    Open volume in Google Drive
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={accepting}
                onClick={() => handleAccept(v.key)}
              >
                {accepting ? <Loader2 className="animate-spin" /> : <Check />}
                Accept
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="flex flex-col gap-2 sm:min-w-0 sm:flex-1 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start sm:w-auto"
            onClick={() => setShowUpload((s) => !s)}
            disabled={album.folderState !== 'ok'}
            title={
              album.folderState !== 'ok'
                ? 'Uploads are paused while the album folder is in the bin or deleted'
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

      <Dialog open={deleteGoneOpen} onOpenChange={setDeleteGoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete album?</DialogTitle>
            <DialogDescription>
              The Google Drive folder is permanently gone. The album will be
              replaced by a notice, and any photos still held elsewhere are left
              untouched and stop being managed by the app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteGoneOpen(false)}
              disabled={deletingGone}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteGone}
              disabled={deletingGone}
            >
              {deletingGone && <Loader2 className="animate-spin" />}
              {deletingGone ? 'Deleting...' : 'Delete album'}
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
