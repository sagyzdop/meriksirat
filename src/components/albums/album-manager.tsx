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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { UploadDropzone } from './upload-dropzone'
import { ShareDialog } from './share-dialog'
import {
  deleteAlbumFn,
  recreateAlbumFolderFn,
  refreshAlbumFn,
  removeMemberFn,
  restoreAlbumFolderFn,
  updateAlbumFn,
} from '@/lib/albums'
import type { AlbumDetail } from '@/lib/albums'
import {
  clearUploadReveal,
  useUploadReveal,
} from '@/lib/albums/upload-manager'

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
  const [title, setTitle] = React.useState(album.title)
  const [description, setDescription] = React.useState(album.description)
  const [busy, setBusy] = React.useState(false)
  const [recreating, setRecreating] = React.useState(false)
  const [restoring, setRestoring] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [removing, setRemoving] = React.useState<string | null>(null)
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await updateAlbumFn({
        data: {
          albumId: album.id,
          title: title.trim(),
          description: description.trim() || '',
        },
      })
      toast.success('Album updated')
      setEditOpen(false)
      onChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update album'
      )
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await deleteAlbumFn({ data: { albumId: album.id } })
      toast.success('Album deleted')
      setDeleteOpen(false)
      onDeleted()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete album'
      )
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    if (!currentUserId) return
    setBusy(true)
    try {
      await removeMemberFn({ data: { albumId: album.id, userId: currentUserId } })
      toast.success('You left the album')
      setLeaveOpen(false)
      onDeleted()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to leave album'
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRecreate = async () => {
    setRecreating(true)
    try {
      await recreateAlbumFolderFn({ data: { albumId: album.id } })
      toast.success('Album folder recreated')
      onChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to recreate folder'
      )
    } finally {
      setRecreating(false)
    }
  }

  const handleRestore = async () => {
    setRestoring(true)
    try {
      await restoreAlbumFolderFn({ data: { albumId: album.id } })
      toast.success('Album folder restored')
      onChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to restore folder'
      )
    } finally {
      setRestoring(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshAlbumFn({ data: { albumId: album.id } })
      toast.success('Album refreshed')
      onChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to refresh album'
      )
    } finally {
      setRefreshing(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setRemoving(userId)
    try {
      await removeMemberFn({ data: { albumId: album.id, userId } })
      toast.success('Co-author removed')
      onChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove member'
      )
    } finally {
      setRemoving(null)
    }
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
            The folder behind this album was permanently deleted, so its
            photos are gone. You can recreate an empty folder to keep
            uploading, or delete the album.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={recreating}
              onClick={handleRecreate}
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
            The folder behind this album was moved to the bin in Drive.
            Uploads are paused until it is restored.
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
            onClick={() => {
              setTitle(album.title)
              setDescription(album.description)
              setEditOpen(true)
            }}
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
            {refreshing ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit album</DialogTitle>
            <DialogDescription>
              Update the title and description.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="album-title">Title</Label>
              <Input
                id="album-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="album-description">Description</Label>
              <Textarea
                id="album-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                {busy ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
