import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  moveAlbumsToBufferFn,
  previewAlbumMovesFn,
} from '@/lib/albums/storage-functions'
import { errorMessage } from '@/lib/utils'
import type { AdminAlbumRow } from '@/lib/albums/types'
import { SkippedItems, movableIds, previewSkips } from './move-preview-summary'

interface MoveToBufferDialogProps {
  albums: AdminAlbumRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

export function MoveToBufferDialog({
  albums,
  open,
  onOpenChange,
  onDone,
}: MoveToBufferDialogProps) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<{
    moved: number
    skipped: { albumId: string; reason: string }[]
  } | null>(null)

  const albumIds = React.useMemo(() => albums.map((a) => a.id), [albums])
  const titles = React.useMemo(
    () => new Map(albums.map((a) => [a.id, a.title])),
    [albums]
  )

  React.useEffect(() => {
    if (open) setResult(null)
  }, [open])

  const preview = useQuery({
    queryKey: ['albums', 'move-preview', 'buffer', albumIds],
    queryFn: () =>
      previewAlbumMovesFn({ data: { albumIds, target: 'buffer' } }),
    enabled: open && albumIds.length > 0 && !result,
    staleTime: 0,
    gcTime: 0,
  })

  const counts = preview.data?.counts
  const ids = preview.data ? movableIds(preview.data.items) : []

  const confirm = async () => {
    setBusy(true)
    try {
      const outcome = await moveAlbumsToBufferFn({ data: { albumIds: ids } })
      setResult(outcome)
      toast.success(
        `Moved ${outcome.moved} album${outcome.moved === 1 ? '' : 's'} to the Buffer`
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['albums'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ])
      onDone()
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to move albums'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to Buffer</DialogTitle>
          <DialogDescription>
            Albums held by Flamekeepers are copied back to the Buffer account.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              Moved {result.moved} album{result.moved === 1 ? '' : 's'}.
            </p>
            <SkippedItems items={result.skipped} titles={titles} />
          </div>
        ) : preview.isError ? (
          <p className="text-sm text-destructive">
            {errorMessage(preview.error, 'Could not preview the move')}
          </p>
        ) : !counts ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <ul className="space-y-1">
              <li>{counts.selected} selected</li>
              <li>{counts.onBuffer} on Buffer</li>
              <li>{counts.onFlamekeeper} on Flamekeepers</li>
              <li>{counts.unknown} unknown</li>
            </ul>
            <p className="font-medium">
              {counts.movable} album{counts.movable === 1 ? '' : 's'} will be
              moved from Flamekeepers to Buffer.
            </p>
            <SkippedItems
              items={previewSkips(preview.data!.items)}
              titles={titles}
            />
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy || ids.length === 0}
                onClick={confirm}
              >
                {busy ? 'Moving...' : 'Confirm'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
