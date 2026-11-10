import * as React from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
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
import { toast } from 'sonner'
import { albumShareText, rotateEditTokenFn } from '@/lib/albums'
import type { AlbumDetail } from '@/lib/albums'
import { errorMessage } from '@/lib/utils'

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
      toast.error(errorMessage(error, 'Failed to rotate edit link'))
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
              Every album is public. Anyone with the view link can open it; the
              edit link adds a logged-in user as a co-author.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="view-url">View link</Label>
              <div className="flex gap-2">
                <Input id="view-url" readOnly value={viewUrl} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
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
              <p className="text-xs text-muted-foreground">
                Copies a ready-to-paste Telegram message with the album name,
                description, and author Telegram handles.
              </p>
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
