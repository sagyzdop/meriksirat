import * as React from 'react'
import { Check, Copy, Link2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  albumShareText,
  rotateEditTokenFn,
  toggleAlbumShareFn,
} from '@/lib/albums'
import type { AlbumDetail } from '@/lib/albums'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  album: AlbumDetail
  onChanged: () => void
}

export function ShareDialog({
  open,
  onOpenChange,
  album,
  onChanged,
}: ShareDialogProps) {
  const [toggling, setToggling] = React.useState(false)
  const [copied, setCopied] = React.useState<'view' | 'edit' | null>(null)
  const [rotating, setRotating] = React.useState(false)
  const [rotateOpen, setRotateOpen] = React.useState(false)
  const [editToken, setEditToken] = React.useState(album.editShareToken)
  const [origin, setOrigin] = React.useState('')

  React.useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  React.useEffect(() => {
    setEditToken(album.editShareToken)
  }, [album.editShareToken])

  const viewUrl = `${origin}/albums/${album.id}`
  const editUrl = `${origin}/albums/${album.id}?edit=${editToken}`

  const canRotate = album.access === 'owner' || album.access === 'manager'

  const handleToggleShare = async (shared: boolean) => {
    setToggling(true)
    try {
      await toggleAlbumShareFn({ data: { albumId: album.id, shared } })
      toast.success(shared ? 'Album is now public' : 'Album is now private')
      onChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update sharing'
      )
    } finally {
      setToggling(false)
    }
  }

  const handleRotate = async () => {
    setRotating(true)
    try {
      const result = await rotateEditTokenFn({
        data: { albumId: album.id },
      })
      setEditToken(result.editShareToken)
      setRotateOpen(false)
      try {
        await navigator.clipboard.writeText(
          `${origin}/albums/${album.id}?edit=${result.editShareToken}`
        )
        setCopied('edit')
        setTimeout(() => setCopied(null), 1500)
        toast.success('Edit link rotated — new link copied')
      } catch {
        toast.success('Edit link rotated')
      }
      onChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to rotate edit link'
      )
    } finally {
      setRotating(false)
    }
  }

  const copy = async (
    value: string,
    kind: 'view' | 'edit',
    successMessage?: string
  ) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      toast.success(successMessage ?? 'Link copied')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share album</DialogTitle>
            <DialogDescription>
              The Drive folder is always public. Turning off the view link hides
              the album from the app&apos;s public view; the edit link adds a
              logged-in user as a co-author.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="size-4" />
                  Public view link
                </div>
                <p className="text-xs text-muted-foreground">
                  {album.isShared
                    ? 'Anyone with the link can view the album.'
                    : 'The link is disabled in the app; you and co-authors can still open it.'}
                </p>
              </div>
              <Switch
                checked={album.isShared}
                disabled={toggling}
                onCheckedChange={handleToggleShare}
                aria-label="Toggle public view link"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="view-url">View link</Label>
              <div className="flex gap-2">
                <Input id="view-url" readOnly value={viewUrl} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!album.isShared}
                  onClick={() =>
                    copy(
                      albumShareText(album, origin),
                      'view',
                      'Copied to clipboard'
                    )
                  }
                  aria-label="Copy view link"
                  title="Copy view link"
                >
                  {copied === 'view' ? <Check /> : <Copy />}
                </Button>
              </div>
              {album.isShared ? (
                <p className="text-xs text-muted-foreground">
                  Copies a ready-to-paste Telegram message with the album name,
                  description, and author Telegram handles.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Turn on the view link to let anyone open this album in the
                  app.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-url">Edit link (co-author)</Label>
              <div className="flex gap-2">
                <Input id="edit-url" readOnly value={editUrl} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copy(editUrl, 'edit')}
                  aria-label="Copy edit link"
                >
                  {copied === 'edit' ? <Check /> : <Copy />}
                </Button>
                {canRotate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={rotating}
                    onClick={() => setRotateOpen(true)}
                    aria-label="Rotate edit link"
                    title="Rotate edit link"
                  >
                    <RefreshCw
                      className={rotating ? 'animate-spin' : undefined}
                    />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Opening this link while logged in adds the user as a co-author
                with upload and edit rights.
              </p>
              {canRotate && (
                <p className="text-xs text-muted-foreground">
                  Rotating the link invalidates every previously shared edit
                  link.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate the edit link?</AlertDialogTitle>
            <AlertDialogDescription>
              A new edit link will be generated and the current one will stop
              working. Anyone with the old link will no longer be able to join
              as a co-author.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRotate()
              }}
              disabled={rotating}
            >
              {rotating ? 'Rotating...' : 'Rotate link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
