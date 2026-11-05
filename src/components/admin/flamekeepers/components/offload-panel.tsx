// PROTOTYPE: the dashboard "Free up space" list, rebuilt as a data table with
// an expiry date range picker for the flamekeepers admin screen.
import { useMemo, useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DateRangeFilter } from '@/components/shared/date-range-filter'
import { Section } from '@/components/layout/section'
import { useAsyncAction } from '@/hooks/use-async-action'
import { expireAlbumNowFn } from '@/lib/admin/functions/free-space'
import type { FreeSpaceSuggestion } from '@/lib/admin/functions/free-space'
import { formatBytes } from '@/components/admin/dashboard/components/album-storage-cards'

interface OffloadPanelProps {
  suggestions: FreeSpaceSuggestion[]
  isLoading?: boolean
  compact?: boolean
}

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

export function OffloadPanel({
  suggestions,
  isLoading = false,
  compact = false,
}: OffloadPanelProps) {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<DateRange | undefined>()
  const [target, setTarget] = useState<FreeSpaceSuggestion | null>(null)
  const { pending: isExpiring, run } = useAsyncAction()

  const visible = useMemo(() => {
    if (!range?.from) return suggestions
    const from = dayStart(range.from)
    const to = range.to ? dayEnd(range.to) : dayEnd(range.from)
    return suggestions.filter((suggestion) => {
      if (!suggestion.expiresAt) return false
      const expires = new Date(suggestion.expiresAt).getTime()
      return expires >= from && expires <= to
    })
  }, [range, suggestions])

  const handleExpire = async () => {
    if (!target) return
    await run(async () => {
      const result = await expireAlbumNowFn({ data: { albumId: target.id } })
      toast.success(
        `"${target.title}" will be deleted in 7 days. ${result.notified} ${result.notified === 1 ? 'person' : 'people'} notified.`
      )
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['albums'] })
    }, 'Failed to expire album')
    setTarget(null)
  }

  return (
    <Section
      title="Albums to offload"
      description={
        compact
          ? 'Candidates for early expiry, filtered by expiry date.'
          : 'Unpinned albums nobody favorited come first, then favorited ones; each group by soonest expiry, then largest size. Expiring an album now gives its owner and everyone who favorited a photo in it 7 days’ notice.'
      }
      actions={
        <DateRangeFilter
          from={range?.from?.toISOString()}
          to={range?.to?.toISOString()}
          onChange={setRange}
        />
      }
      spacing="compact"
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : visible.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          {range?.from
            ? 'No albums expire in that range.'
            : 'No albums to suggest.'}
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Album</TableHead>
                <TableHead className="whitespace-nowrap">Expires</TableHead>
                <TableHead className="whitespace-nowrap">Size</TableHead>
                <TableHead className="whitespace-nowrap">Favorites</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((suggestion) => (
                <TableRow key={suggestion.id}>
                  <TableCell className="font-medium">
                    {suggestion.title}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {suggestion.expiresAt
                      ? new Date(suggestion.expiresAt).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )
                      : 'Never'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatBytes(suggestion.photoBytes)}
                  </TableCell>
                  <TableCell>{suggestion.favoriteCount}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTarget(suggestion)}
                    >
                      Expire now
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
    </Section>
  )
}
