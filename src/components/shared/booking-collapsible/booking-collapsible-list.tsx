import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { format, isPast } from 'date-fns'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { DataTableFacetedFilter } from '@/components/shared/data-table-faceted-filter'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import {
  BookingStatusBadge,
  isBookingOverdue,
} from '@/components/shared/booking-status-badge'
import { BulkCancelBookingsDialog } from '@/components/shared/bulk-cancel-bookings-dialog'
import { ServerDataTablePagination } from '@/components/shared/data-table/server-data-table-pagination'
import { cn } from '@/lib/utils'
import type {
  BookingCollapsibleFilters,
  BookingCollapsiblePagination,
  BookingCollapsiblePersonInfo,
  BookingCollapsibleRowData,
  BookingStatusOption,
} from './types'

const SELECT_W = 'w-4'
const ID_W = 'w-14'
const CHEVRON_W = 'w-4'

const TOOLBAR_BUTTON_CLASS = 'h-8 border-dashed'

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function resolveImageSrc(image?: string | null): string | undefined {
  if (!image) return undefined
  // User avatars are absolute URLs (e.g. Google OAuth) while R2-backed images
  // are bare keys served through /api/images/{key}.
  if (image.startsWith('http') || image.startsWith('/')) return image
  return `/api/images/${image}`
}

interface PersonLinkProps {
  person: BookingCollapsiblePersonInfo
}

function PersonLink({ person }: PersonLinkProps) {
  const router = useRouter()

  const content = (
    <>
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={resolveImageSrc(person.image)} alt={person.name} />
        <AvatarFallback className="text-[10px]">
          {getInitials(person.name)}
        </AvatarFallback>
      </Avatar>
      <span className="hidden truncate sm:inline">{person.name}</span>
    </>
  )

  if (person.href) {
    return (
      <a
        href={person.href}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          router.navigate({ href: person.href! })
        }}
        className="flex min-w-0 max-w-40 items-center gap-2 font-medium hover:underline lg:max-w-48"
      >
        {content}
      </a>
    )
  }

  return (
    <span className="flex min-w-0 max-w-40 items-center gap-2 font-medium lg:max-w-48">
      {content}
    </span>
  )
}

interface BookingCollapsibleRowProps<T extends BookingCollapsibleRowData> {
  booking: T
  name: string
  person?: BookingCollapsiblePersonInfo
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  renderCollapsibleContent: (booking: T) => React.ReactNode
}

function BookingCollapsibleRow<T extends BookingCollapsibleRowData>({
  booking,
  name,
  person,
  selected,
  onSelectedChange,
  renderCollapsibleContent,
}: BookingCollapsibleRowProps<T>) {
  const isOverdue = isBookingOverdue(booking.endTime, booking.status)

  const itemCount = booking.items.length
  const itemLabel = itemCount === 1 ? 'item' : 'items'

  return (
    <Collapsible className="rounded-md border bg-card">
      <CollapsibleTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className="group flex cursor-pointer items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:gap-3"
        >
          <div
            className={cn(SELECT_W, 'flex items-center')}
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={(value) => onSelectedChange(!!value)}
              aria-label={`Select booking ${booking.id}`}
            />
          </div>

          <span
            className={cn(
              ID_W,
              'font-medium text-muted-foreground tabular-nums'
            )}
          >
            #{booking.id}
          </span>

          {person ? (
            <PersonLink person={person} />
          ) : (
            <span className="min-w-0 max-w-40 truncate font-medium lg:max-w-48">
              {name}
            </span>
          )}

          <div
            className={cn(
              'ml-auto flex min-w-0 items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs tabular-nums',
              isOverdue && 'bg-destructive/10'
            )}
          >
            <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="hidden min-w-0 truncate text-muted-foreground sm:inline">
              {format(new Date(booking.startTime), 'MMM d')}
            </span>
            <span
              className={cn(
                'shrink-0 font-medium',
                isOverdue && 'text-destructive'
              )}
            >
              {format(new Date(booking.startTime), 'HH:mm')}
            </span>
            <ArrowRight
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span
              className={cn(
                'shrink-0 font-medium',
                isOverdue && 'text-destructive'
              )}
            >
              {format(new Date(booking.endTime), 'HH:mm')}
            </span>
          </div>

          <Badge
            variant="secondary"
            className="h-6 min-w-6 shrink-0 justify-center rounded-full px-2 text-sm tabular-nums sm:min-w-14"
            title={`${itemCount} ${itemLabel}`}
          >
            <span className="tabular-nums">{itemCount}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              &nbsp;{itemLabel}
            </span>
          </Badge>

          <span className="shrink-0">
            <BookingStatusBadge
              status={booking.status}
              endTime={booking.endTime}
              showOverdueIcon
              mobileDot
              colorized
              className="h-6 w-6 shrink-0 justify-center rounded-full sm:w-36"
            />
          </span>

          <ChevronRight
            className={cn(
              CHEVRON_W,
              'shrink-0 transition-transform group-data-[state=open]:rotate-90'
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {renderCollapsibleContent(booking)}
      </CollapsibleContent>
    </Collapsible>
  )
}

interface BookingCollapsibleListProps<T extends BookingCollapsibleRowData> {
  bookings: T[]
  pagination: BookingCollapsiblePagination
  filters: BookingCollapsibleFilters
  statusOptions: BookingStatusOption[]
  isLoading?: boolean
  showOverdueBanner?: boolean
  calendarActionText: string
  isCancellable: (status: string) => boolean
  bulkCancelFn: (bookingId: number) => Promise<unknown>
  queryKey?: string[]
  getDisplayName: (booking: T) => string
  getPersonInfo?: (booking: T) => BookingCollapsiblePersonInfo
  renderCollapsibleContent: (booking: T) => React.ReactNode
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  onStatusFilterChange: (values: string[] | undefined) => void
  onResetFilters: () => void
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
}

export function BookingCollapsibleList<T extends BookingCollapsibleRowData>({
  bookings,
  pagination,
  filters,
  statusOptions,
  isLoading = false,
  showOverdueBanner = false,
  calendarActionText,
  isCancellable,
  bulkCancelFn,
  queryKey = ['bookings'],
  getDisplayName,
  getPersonInfo,
  renderCollapsibleContent,
  onSortChange,
  onStatusFilterChange,
  onResetFilters,
  onPageChange,
  onPageSizeChange,
}: BookingCollapsibleListProps<T>) {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(
    () => new Set()
  )
  const [bulkCancelOpen, setBulkCancelOpen] = React.useState(false)
  const [isBulkCancelling, setIsBulkCancelling] = React.useState(false)

  const overdueCount = React.useMemo(() => {
    if (!showOverdueBanner) return 0
    return bookings.filter(
      (booking) =>
        isPast(new Date(booking.endTime)) &&
        (booking.status === 'active' || booking.status === 'partially_returned')
    ).length
  }, [bookings, showOverdueBanner])

  const isFiltered = !!filters.status && filters.status.length > 0

  const allPageSelected =
    bookings.length > 0 &&
    bookings.every((booking) => selectedIds.has(booking.id))

  const toggleAllRows = (selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      bookings.forEach((booking) => {
        if (selected) next.add(booking.id)
        else next.delete(booking.id)
      })
      return next
    })
  }

  const toggleRow = (bookingId: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(bookingId)
      else next.delete(bookingId)
      return next
    })
  }

  const cancellableBookingIds = bookings
    .filter(
      (booking) => selectedIds.has(booking.id) && isCancellable(booking.status)
    )
    .map((booking) => booking.id)

  const handleBulkCancel = async () => {
    if (cancellableBookingIds.length === 0) return

    setIsBulkCancelling(true)
    const results = await Promise.allSettled(
      cancellableBookingIds.map(bulkCancelFn)
    )

    const successCount = results.filter(
      (result) => result.status === 'fulfilled'
    ).length
    const failedCount = results.length - successCount

    if (successCount > 0) {
      toast.success(
        `Cancelled ${successCount} booking${successCount === 1 ? '' : 's'}`
      )
      setSelectedIds(new Set())
      await queryClient.invalidateQueries({ queryKey })
    }

    if (failedCount > 0) {
      toast.error('Some bookings could not be cancelled', {
        description: `Failed to cancel ${failedCount} booking${failedCount === 1 ? '' : 's'}.`,
      })
    }

    setIsBulkCancelling(false)
    setBulkCancelOpen(false)
  }

  return (
    <div className="space-y-4">
      {overdueCount > 0 && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive">
              <span className="text-[10px] font-bold text-white">!</span>
            </div>
            <p className="text-sm font-medium text-destructive">
              {overdueCount} overdue booking{overdueCount === 1 ? '' : 's'}{' '}
              detected on this page
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={TOOLBAR_BUTTON_CLASS}
            onClick={() => toggleAllRows(!allPageSelected)}
            aria-label={
              allPageSelected
                ? 'Deselect all bookings on this page'
                : 'Select all bookings on this page'
            }
          >
            <Check
              className={cn('h-4 w-4', !allPageSelected && 'opacity-40')}
            />
            {allPageSelected ? 'Deselect all' : 'Select all'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={TOOLBAR_BUTTON_CLASS}
            onClick={() =>
              onSortChange(
                'createdAt',
                filters.sortOrder === 'asc' ? 'desc' : 'asc'
              )
            }
          >
            Created
            {filters.sortBy === 'createdAt' ? (
              filters.sortOrder === 'asc' ? (
                <ArrowUp className="ml-1 h-3.5 w-3.5" />
              ) : (
                <ArrowDown className="ml-1 h-3.5 w-3.5" />
              )
            ) : (
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />
            )}
          </Button>
          <DataTableFacetedFilter
            title="Status"
            options={statusOptions}
            selectedValues={filters.status || []}
            onSelectionChange={(values) => onStatusFilterChange(values)}
          />
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={onResetFilters}
              className="h-8 px-2 lg:px-3"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            variant="destructive"
            size="sm"
            className="h-8 w-full sm:w-auto"
            disabled={cancellableBookingIds.length === 0}
            onClick={() => setBulkCancelOpen(true)}
          >
            Cancel Selected
          </Button>
        </div>
      </div>

      <div className="relative space-y-3">
        {isLoading && <LoadingOverlay />}

        {!isLoading && bookings.length === 0 ? (
          <div className="rounded-md border py-16 text-center text-sm text-muted-foreground">
            No results.
          </div>
        ) : (
          bookings.map((booking) => (
            <BookingCollapsibleRow
              key={booking.id}
              booking={booking}
              name={getDisplayName(booking)}
              person={getPersonInfo?.(booking)}
              selected={selectedIds.has(booking.id)}
              onSelectedChange={(selected) => toggleRow(booking.id, selected)}
              renderCollapsibleContent={renderCollapsibleContent}
            />
          ))
        )}
      </div>

      <BulkCancelBookingsDialog
        open={bulkCancelOpen}
        onOpenChange={setBulkCancelOpen}
        cancellableCount={cancellableBookingIds.length}
        totalSelectedCount={selectedIds.size}
        isProcessing={isBulkCancelling}
        onConfirm={handleBulkCancel}
        calendarActionText={calendarActionText}
      />

      <ServerDataTablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        limit={pagination.limit}
        selectedCount={selectedIds.size}
        totalCount={pagination.total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  )
}
