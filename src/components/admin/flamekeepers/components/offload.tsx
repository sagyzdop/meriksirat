// PROTOTYPE: the dashboard offload list as a plain table, with the long
// explanation removed. Optionally collapsed behind its heading.
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import { useAsyncAction } from '@/hooks/use-async-action'
import { expireAlbumNowFn } from '@/lib/admin/functions/free-space'
import type { FreeSpaceSuggestion } from '@/lib/admin/functions/free-space'
import { formatBytes } from '@/components/admin/dashboard/components/album-storage-cards'
import { cn } from '@/lib/utils'

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

function ExpireDialog({
  target,
  onClose,
}: {
  target: FreeSpaceSuggestion | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { pending: isExpiring, run } = useAsyncAction()

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
    onClose()
  }

  return (
    <AlertDialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !isExpiring) onClose()
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
  )
}

interface OffloadSectionProps {
  suggestions: FreeSpaceSuggestion[]
  isLoading?: boolean
  collapsible?: boolean
}

export function OffloadSection({
  suggestions,
  isLoading = false,
  collapsible = false,
}: OffloadSectionProps) {
  const [range, setRange] = useState<DateRange | undefined>()
  const [target, setTarget] = useState<FreeSpaceSuggestion | null>(null)
  const [open, setOpen] = useState(false)

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

  const content = isLoading ? (
    <Skeleton className="h-32 w-full rounded-md" />
  ) : visible.length === 0 ? (
    <p className="rounded-md border border-dashed px-4 py-4 text-sm text-muted-foreground">
      {range?.from ? 'No albums expire in that range.' : 'Nothing to offload.'}
    </p>
  ) : (
    <div className="overflow-x-auto rounded-md border">
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
              <TableCell className="font-medium">{suggestion.title}</TableCell>
              <TableCell className="whitespace-nowrap">
                {suggestion.expiresAt
                  ? new Date(suggestion.expiresAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
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
                  Expire
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  const title = (
    <span className="flex items-baseline gap-2">
      <span className="text-base font-semibold">Albums to offload</span>
      <span className="text-sm font-normal text-muted-foreground">
        {visible.length}
      </span>
    </span>
  )

  const dateFilter = (
    <DateRangeFilter
      from={range?.from?.toISOString()}
      to={range?.to?.toISOString()}
      onChange={setRange}
    />
  )

  const dialog = (
    <ExpireDialog target={target} onClose={() => setTarget(null)} />
  )

  if (!collapsible) {
    return (
      <section aria-label="Albums to offload" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-baseline gap-2 text-base font-semibold">
            Albums to offload
            <span className="text-sm font-normal text-muted-foreground">
              {visible.length}
            </span>
          </h2>
          {dateFilter}
        </div>
        {content}
        {dialog}
      </section>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section aria-label="Albums to offload" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2 h-8">
              {title}
              <ChevronDown
                className={cn(
                  'ml-1 size-4 transition-transform',
                  open && 'rotate-180'
                )}
              />
            </Button>
          </CollapsibleTrigger>
          {dateFilter}
        </div>
        <CollapsibleContent>{content}</CollapsibleContent>
        {dialog}
      </section>
    </Collapsible>
  )
}
