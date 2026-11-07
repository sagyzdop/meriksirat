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
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import { deletionDate } from '@/lib/albums/storage-plan'
import {
  cancelAlbumsDeletionFn,
  scheduleAlbumsDeletionFn,
} from '@/lib/albums/storage-functions'
import { formatUtcDate } from '@/lib/format'
import { errorMessage } from '@/lib/utils'
import type { AdminAlbumRow } from '@/lib/albums/types'

interface DeletionDialogProps {
  albums: AdminAlbumRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

function useInvalidateAlbums() {
  const queryClient = useQueryClient()
  return React.useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['albums'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]),
    [queryClient]
  )
}

export function ScheduleDeletionDialog({
  albums,
  open,
  onOpenChange,
  onDone,
}: DeletionDialogProps) {
  const invalidate = useInvalidateAlbums()
  const [busy, setBusy] = React.useState(false)
  const { data: settings } = useQuery({
    ...adminDashboardQueries.settings(),
    enabled: open,
  })

  const due = albums.filter((a) => !a.scheduledDeletionAt)
  const already = albums.length - due.length
  const date = settings
    ? formatUtcDate(
        deletionDate(new Date(), settings.albumDeletionNoticeDays).toISOString()
      )
    : null

  const confirm = async () => {
    setBusy(true)
    try {
      const result = await scheduleAlbumsDeletionFn({
        data: { albumIds: due.map((a) => a.id) },
      })
      toast.success(
        `Scheduled ${result.scheduled} album${result.scheduled === 1 ? '' : 's'} for deletion` +
          (result.skipped ? ` (${result.skipped} skipped)` : '')
      )
      await invalidate()
      onDone()
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to schedule deletion'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule for deletion</DialogTitle>
          <DialogDescription>
            Owners are notified of the deletion date.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="font-medium">
            {due.length} album{due.length === 1 ? '' : 's'} will be deleted on{' '}
            {date ?? '...'}.
          </p>
          {already > 0 && (
            <p className="text-muted-foreground">
              {already} already scheduled and will be skipped.
            </p>
          )}
        </div>
        <DialogFooter>
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
            variant="destructive"
            disabled={busy || due.length === 0 || !date}
            onClick={confirm}
          >
            {busy ? 'Scheduling...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CancelDeletionDialog({
  albums,
  open,
  onOpenChange,
  onDone,
}: DeletionDialogProps) {
  const invalidate = useInvalidateAlbums()
  const [busy, setBusy] = React.useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await cancelAlbumsDeletionFn({
        data: { albumIds: albums.map((a) => a.id) },
      })
      toast.success('Scheduled deletion cancelled')
      await invalidate()
      onDone()
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to cancel deletion'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel scheduled deletion</DialogTitle>
          <DialogDescription>
            {albums.length} album{albums.length === 1 ? '' : 's'} will no longer
            be deleted on the scheduled date.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={confirm}>
            {busy ? 'Working...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
