import * as React from 'react'
import type { AdminAlbumRow } from '@/lib/albums/types'
import type { AlbumBulkAction, OnBulkAction } from './album-table-types'
import { MoveToBufferDialog } from './move-to-buffer-dialog'
import { MoveToFlamekeeperDialog } from './move-to-flamekeeper-dialog'
import {
  CancelDeletionDialog,
  ScheduleDeletionDialog,
} from './schedule-deletion-dialog'

interface PendingAction {
  action: AlbumBulkAction
  albums: AdminAlbumRow[]
}

export function useAlbumBulkActions(options: { onDone?: () => void } = {}) {
  const [pending, setPending] = React.useState<PendingAction | null>(null)
  const [open, setOpen] = React.useState(false)
  const [resetToken, setResetToken] = React.useState(0)
  const onDoneRef = React.useRef(options.onDone)
  onDoneRef.current = options.onDone

  const onBulkAction = React.useCallback<OnBulkAction>((action, albums) => {
    setPending({ action, albums })
    setOpen(true)
  }, [])

  const handleDone = React.useCallback(() => {
    setResetToken((n) => n + 1)
    onDoneRef.current?.()
  }, [])

  const albums = pending?.albums ?? []
  const shared = { albums, open, onOpenChange: setOpen, onDone: handleDone }

  const dialogs = (
    <>
      {pending?.action === 'move-to-buffer' && (
        <MoveToBufferDialog {...shared} />
      )}
      {pending?.action === 'move-to-flamekeeper' && (
        <MoveToFlamekeeperDialog {...shared} />
      )}
      {pending?.action === 'schedule-deletion' && (
        <ScheduleDeletionDialog {...shared} />
      )}
      {pending?.action === 'cancel-deletion' && (
        <CancelDeletionDialog {...shared} />
      )}
    </>
  )

  return { onBulkAction, dialogs, resetToken }
}
