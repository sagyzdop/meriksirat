import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { DateRange } from 'react-day-picker'

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
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangeFilter } from '@/components/shared/date-range-filter'
import { useAsyncAction } from '@/hooks/use-async-action'
import { expireAlbumNowFn } from '@/lib/admin/functions/free-space'
import type { FreeSpaceSuggestion } from '@/lib/admin/functions/free-space'
import { formatBytes } from '@/components/admin/dashboard/components/album-storage-cards'
import { relativeTime } from '../issues'

function dayStart(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

function dayEnd(date: Date) {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy.getTime()
}

interface ReclaimQueueProps {
  suggestions: FreeSpaceSuggestion[]
  isLoading?: boolean
}

export function ReclaimQueue({
  suggestions,
  isLoading = false,
}: ReclaimQueueProps) {
  const queryClient = useQueryClient()
  const [range, setRange] = React.useState<DateRange | undefined>()
  const [target, setTarget] = React.useState<FreeSpaceSuggestion | null>(null)
  const { pending: isExpiring, run } = useAsyncAction()
  const now = React.useMemo(() => new Date(), [])

  const visible = React.useMemo(() => {
    if (!range?.from) return suggestions
    const from = dayStart(range.from)
    const to = range.to ? dayEnd(range.to) : dayEnd(range.from)
    return suggestions.filter((suggestion) => {
      if (!suggestion.expiresAt) return false
      const expires = new Date(suggestion.expiresAt).getTime()
      return expires >= from && expires <= to
    })
  }, [range, suggestions])

  const reclaimableBytes = visible.reduce(
    (total, suggestion) => total + suggestion.photoBytes,
    0
  )

  const handleExpire = async () => {
    if (!target) return
    await run(async () => {
      const result = await expireAlbumNowFn({ data: { albumId: target.id } })
      toast.success(
        `"${target.title}" will be deleted in 7 days. ${result.notified} ${
          result.notified === 1 ? 'person' : 'people'
        } notified.`
      )
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['albums'] })
    }, 'Failed to expire album')
    setTarget(null)
  }

  return (
    <section aria-label="Space to reclaim" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Space to reclaim
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Expiring an album deletes it in 7 days and notifies its owner and
            everyone who favorited a photo in it.
          </p>
        </div>
        <DateRangeFilter
          from={range?.from?.toISOString()}
          to={range?.to?.toISOString()}
          onChange={setRange}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-md" />
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          {range?.from
            ? 'No albums expire in that range.'
            : 'Nothing to reclaim right now.'}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {visible.length} album{visible.length === 1 ? '' : 's'} ·{' '}
            {formatBytes(reclaimableBytes)} reclaimable
          </p>
          <ul className="max-h-[420px] divide-y overflow-y-auto border-y">
            {visible.map((suggestion) => (
              <li
                key={suggestion.id}
                className="flex items-center gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {suggestion.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {suggestion.expiresAt ? (
                      <>
                        Expires{' '}
                        {relativeTime(new Date(suggestion.expiresAt), now)}
                        {' · '}
                        {new Date(suggestion.expiresAt).toLocaleDateString(
                          undefined,
                          { month: 'short', day: 'numeric', year: 'numeric' }
                        )}
                      </>
                    ) : (
                      'Never expires'
                    )}
                    {' · '}
                    {suggestion.favoriteCount}{' '}
                    {suggestion.favoriteCount === 1 ? 'favorite' : 'favorites'}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatBytes(suggestion.photoBytes)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setTarget(suggestion)}
                >
                  Expire
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <AlertDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !isExpiring) setTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Expire "{target?.title}" now?</AlertDialogTitle>
            <AlertDialogDescription>
              The album will be deleted in 7 days. Its owner and everyone who
              favorited one of its photos are notified now. There is no backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExpiring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isExpiring}
              onClick={(event) => {
                event.preventDefault()
                void handleExpire()
              }}
            >
              Expire and notify
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
