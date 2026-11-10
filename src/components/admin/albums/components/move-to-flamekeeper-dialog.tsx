import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, CircleAlert, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  completeOffloadFn,
  mintOffloadUploadsFn,
  offloadDownloadTokenFn,
  previewAlbumMovesFn,
  startOffloadFn,
} from '@/lib/albums/storage-functions'
import { runOffload } from '@/lib/albums/offload-client'
import { formatBytes } from '@/lib/format'
import { errorMessage } from '@/lib/utils'
import type { AdminAlbumRow } from '@/lib/albums/types'
import { SkippedItems, movableIds, previewSkips } from './move-preview-summary'
import { UserError } from '@/lib/user-error'

type RunStatus =
  | 'waiting'
  | 'starting'
  | 'copying'
  | 'verifying'
  | 'done'
  | 'failed'
  | 'cancelled'

type FileState = 'pending' | 'copying' | 'done'

interface AlbumRun {
  albumId: string
  title: string
  status: RunStatus
  bytesDone: number
  bytesTotal: number
  files: { name: string; state: FileState }[]
  error?: string
}

type Phase = 'confirm' | 'running' | 'finished'

interface MoveToFlamekeeperDialogProps {
  albums: AdminAlbumRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

const MAX_COMPLETE_CALLS = 30

const statusText: Record<RunStatus, string> = {
  waiting: 'Waiting',
  starting: 'Preparing',
  copying: 'Copying',
  verifying: 'Verifying',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function MoveToFlamekeeperDialog({
  albums,
  open,
  onOpenChange,
  onDone,
}: MoveToFlamekeeperDialogProps) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = React.useState<Phase>('confirm')
  const [runs, setRuns] = React.useState<AlbumRun[]>([])
  const abortRef = React.useRef<AbortController | null>(null)

  const albumIds = React.useMemo(() => albums.map((a) => a.id), [albums])
  const titles = React.useMemo(
    () => new Map(albums.map((a) => [a.id, a.title])),
    [albums]
  )

  React.useEffect(() => {
    if (open) {
      setPhase('confirm')
      setRuns([])
    }
  }, [open])

  React.useEffect(() => {
    if (phase !== 'running') return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  const preview = useQuery({
    queryKey: ['albums', 'move-preview', 'flamekeeper', albumIds],
    queryFn: () =>
      previewAlbumMovesFn({ data: { albumIds, target: 'flamekeeper' } }),
    enabled: open && albumIds.length > 0 && phase === 'confirm',
    staleTime: 0,
    gcTime: 0,
  })

  const items = preview.data?.items ?? []
  const movable = items.filter((item) => !item.skipReason)
  const destinations = React.useMemo(() => {
    const map = new Map<
      string,
      { name: string; albums: number; bytes: number; seen: Set<string> }
    >()
    for (const item of movable) {
      const parts = item.volumes ?? [
        {
          userId: item.flamekeeperUserId ?? 'unknown',
          name: item.flamekeeperName,
          bytes: item.bytes,
        },
      ]
      for (const part of parts) {
        const entry = map.get(part.userId) ?? {
          name: part.name ?? 'Flamekeeper',
          albums: 0,
          bytes: 0,
          seen: new Set<string>(),
        }
        if (!entry.seen.has(item.albumId)) {
          entry.seen.add(item.albumId)
          entry.albums += 1
        }
        entry.bytes += part.bytes
        map.set(part.userId, entry)
      }
    }
    return [...map.values()]
  }, [movable])
  const totalBytes = movable.reduce((n, item) => n + item.bytes, 0)

  const patchRun = (albumId: string, patch: Partial<AlbumRun>) =>
    setRuns((current) =>
      current.map((run) =>
        run.albumId === albumId ? { ...run, ...patch } : run
      )
    )

  const patchFile = (albumId: string, index: number, state: FileState) =>
    setRuns((current) =>
      current.map((run) =>
        run.albumId === albumId
          ? {
              ...run,
              files: run.files.map((file, i) =>
                i === index ? { ...file, state } : file
              ),
            }
          : run
      )
    )

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['albums'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ])

  const moveOne = async (
    albumId: string,
    signal: AbortSignal
  ): Promise<boolean> => {
    patchRun(albumId, { status: 'starting', error: undefined })
    const [session] = await startOffloadFn({ data: { albumIds: [albumId] } })
    if (!session) throw new UserError('Could not start the move')
    patchRun(albumId, {
      status: 'copying',
      bytesDone: 0,
      bytesTotal: session.files.reduce((n, f) => n + f.size, 0),
      files: session.files.map((f) => ({ name: f.name, state: 'pending' })),
    })
    await runOffload(session, {
      signal,
      mint: (id, fileIds) =>
        mintOffloadUploadsFn({
          data: { albumId: id, fileIds, origin: window.location.origin },
        }),
      refreshDownloadToken: (id) =>
        offloadDownloadTokenFn({ data: { albumId: id } }),
      onFile: (id, index, state) =>
        patchFile(id, index, state === 'done' ? 'done' : 'copying'),
      onBytes: (id, bytesDone, bytesTotal) =>
        patchRun(id, { bytesDone, bytesTotal }),
    })
    patchRun(albumId, { status: 'verifying' })
    for (let call = 0; call < MAX_COMPLETE_CALLS; call++) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      const result = await completeOffloadFn({ data: { albumId } })
      if (!result.ok) {
        patchRun(albumId, { status: 'failed', error: result.reason })
        return false
      }
      if (result.done) {
        patchRun(albumId, { status: 'done' })
        return true
      }
    }
    patchRun(albumId, {
      status: 'failed',
      error: 'The move did not finish verifying; try again',
    })
    return false
  }

  const runAll = async (ids: string[]) => {
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('running')
    setRuns((current) => {
      const kept = current.filter((run) => !ids.includes(run.albumId))
      return [
        ...kept,
        ...ids.map((albumId) => ({
          albumId,
          title: titles.get(albumId) ?? albumId,
          status: 'waiting' as const,
          bytesDone: 0,
          bytesTotal: 0,
          files: current.find((run) => run.albumId === albumId)?.files ?? [],
        })),
      ]
    })

    let completed = 0
    for (const albumId of ids) {
      if (controller.signal.aborted) {
        patchRun(albumId, { status: 'cancelled' })
        continue
      }
      try {
        if (await moveOne(albumId, controller.signal)) completed += 1
      } catch (error) {
        if (controller.signal.aborted) {
          patchRun(albumId, { status: 'cancelled' })
        } else {
          patchRun(albumId, {
            status: 'failed',
            error: errorMessage(error, 'Copy failed'),
          })
        }
      }
    }

    abortRef.current = null
    setPhase('finished')
    if (completed > 0) {
      toast.success(
        `Moved ${completed} album${completed === 1 ? '' : 's'} to Flamekeepers`
      )
    }
    await refresh()
    onDone()
  }

  const start = () => runAll(movableIds(items))

  const retry = () =>
    runAll(
      runs
        .filter((run) => run.status === 'failed' || run.status === 'cancelled')
        .map((run) => run.albumId)
    )

  const cancelRun = () => abortRef.current?.abort()

  const retryable = runs.some(
    (run) => run.status === 'failed' || run.status === 'cancelled'
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (phase === 'running') return
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Move to Flamekeepers</DialogTitle>
          <DialogDescription>
            Photos are copied through this browser from the Buffer to
            Flamekeepers. Keep this window open; the Buffer copy stays until the
            move is verified.
          </DialogDescription>
        </DialogHeader>

        {phase === 'confirm' &&
          (preview.isError ? (
            <p className="text-sm text-destructive">
              {errorMessage(preview.error, 'Could not preview the move')}
            </p>
          ) : !preview.data ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium">
                {movable.length} of {preview.data.counts.selected} selected
                album{preview.data.counts.selected === 1 ? '' : 's'} will move (
                {formatBytes(totalBytes)}).
              </p>
              {destinations.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium">Destination</p>
                  <ul className="space-y-1">
                    {destinations.map((dest) => (
                      <li
                        key={dest.name}
                        className="flex justify-between gap-2"
                      >
                        <span>{dest.name}</span>
                        <span className="text-muted-foreground">
                          {dest.albums} album{dest.albums === 1 ? '' : 's'},{' '}
                          {formatBytes(dest.bytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <SkippedItems items={previewSkips(items)} titles={titles} />
            </div>
          ))}

        {phase !== 'confirm' && (
          <div className="space-y-4 text-sm">
            {runs.map((run) => {
              const percent = run.bytesTotal
                ? Math.round((run.bytesDone / run.bytesTotal) * 100)
                : run.status === 'done'
                  ? 100
                  : 0
              return (
                <div
                  key={run.albumId}
                  className="space-y-2 rounded-md border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{run.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {statusText[run.status]}
                    </span>
                  </div>
                  <Progress value={run.status === 'done' ? 100 : percent} />
                  {run.error && <p className="text-destructive">{run.error}</p>}
                  <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs">
                    {run.files.map((file, index) => {
                      const state =
                        run.status === 'done'
                          ? 'done'
                          : file.state === 'copying' && run.status === 'failed'
                            ? 'failed'
                            : file.state === 'copying' &&
                                run.status !== 'copying'
                              ? 'pending'
                              : file.state
                      return (
                        <li
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-1.5"
                        >
                          {state === 'done' ? (
                            <Check className="size-3 shrink-0" />
                          ) : state === 'copying' ? (
                            <Loader2 className="size-3 shrink-0 animate-spin" />
                          ) : state === 'failed' ? (
                            <CircleAlert className="size-3 shrink-0 text-destructive" />
                          ) : (
                            <span className="size-3 shrink-0" />
                          )}
                          <span className="truncate">{file.name}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
            {phase === 'finished' && retryable && (
              <p className="text-muted-foreground">
                Albums that did not finish are unchanged and stay on the Buffer.
                Retrying within 6 hours skips the photos already copied.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === 'confirm' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={movable.length === 0}
                onClick={start}
              >
                Confirm
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button type="button" variant="outline" onClick={cancelRun}>
              Cancel
            </Button>
          )}
          {phase === 'finished' && (
            <>
              {retryable && (
                <Button type="button" variant="outline" onClick={retry}>
                  Retry unfinished
                </Button>
              )}
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
