import * as React from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { toggleAlbumShareFn } from '@/lib/albums'
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
  const [origin, setOrigin] = React.useState('')

  React.useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const viewUrl = `${origin}/albums/${album.id}`
  const editUrl = `${origin}/albums/${album.id}?edit=${album.editShareToken}`

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

  const copy = async (value: string, kind: 'view' | 'edit') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      toast.success('Link copied')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share album</DialogTitle>
          <DialogDescription>
            Anyone with the view link can see the album when it is public. The
            edit link adds a logged-in user as a co-author.
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
                  ? 'Anyone with the link can view.'
                  : 'Only you and co-authors can view.'}
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
                onClick={() => copy(viewUrl, 'view')}
                aria-label="Copy view link"
              >
                {copied === 'view' ? <Check /> : <Copy />}
              </Button>
            </div>
            {!album.isShared && (
              <p className="text-xs text-muted-foreground">
                Turn on the public view link to enable it.
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
            </div>
            <p className="text-xs text-muted-foreground">
              Opening this link while logged in adds the user as a co-author
              with upload and edit rights.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
