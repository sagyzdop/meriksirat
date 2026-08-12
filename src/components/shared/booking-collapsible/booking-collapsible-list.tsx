import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format, isPast } from 'date-fns'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  MessageCircle,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { createTelegramBotLink } from '@/lib/telegram/client-utils'
import { cn } from '@/lib/utils'
import type {
  BookingCollapsibleFilters,
  BookingCollapsiblePagination,
  BookingCollapsibleRowData,
  BookingStatusOption,
} from './types'

const SELECT_W = 'w-4'
const ID_W = 'w-14'
const START_W = 'w-24'
const END_W = 'w-24'
const STATUS_W = 'min-w-[7rem]'
const CHEVRON_W = 'w-4'

interface SortableHeaderButtonProps {
  label: string
  column: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
}

function SortableHeaderButton({
  label,
  column,
  sortBy,
  sortOrder,
  onSortChange,
}: SortableHeaderButtonProps) {
  const active = sortBy === column

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 font-medium text-muted-foreground hover:text-foreground"
      onClick={() => {
        const order = active ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc'
        onSortChange(column, order)
      }}
    >
      {label}
      {active ? (
        sortOrder === 'asc' ? (
          <ArrowUp className="ml-1 h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="ml-1 h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />
      )}
    </Button>
  )
}

interface BookingCollapsibleRowProps<T extends BookingCollapsibleRowData> {
  booking: T
  name: string
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  renderCollapsibleContent: (booking: T) => React.ReactNode
}

function BookingCollapsibleRow<T extends BookingCollapsibleRowData>({
  booking,
  name,
  selected,
  onSelectedChange,
  renderCollapsibleContent,
}: BookingCollapsibleRowProps<T>) {
  const isOverdue = isBookingOverdue(booking.endTime, booking.status)

  return (
    <Collapsible className="rounded-md border bg-card">
      <CollapsibleTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
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
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          <div className={cn(START_W, 'hidden text-right sm:block')}>
            <p className="text-sm font-medium tabular-nums">
              {format(new Date(booking.startTime), 'MMM dd, yyyy')}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {format(new Date(booking.startTime), 'HH:mm')}
            </p>
          </div>
          <div className={cn(END_W, 'hidden text-right md:block')}>
            <p
              className={cn(
                'text-sm font-medium tabular-nums',
                isOverdue && 'text-destructive'
              )}
            >
              {format(new Date(booking.endTime), 'MMM dd, yyyy')}
            </p>
            <p
              className={cn(
                'flex items-center justify-end gap-1 text-xs tabular-nums',
                isOverdue ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {isOverdue && <AlertCircle className="h-3 w-3" />}
              {format(new Date(booking.endTime), 'HH:mm')}
            </p>
          </div>
          <span className={cn(STATUS_W, 'flex justify-center')}>
            <BookingStatusBadge
              status={booking.status}
              endTime={booking.endTime}
              showOverdueIcon
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
  telegramBotUsername?: string
  calendarActionText: string
  isCancellable: (status: string) => boolean
  bulkCancelFn: (bookingId: number) => Promise<unknown>
  queryKey?: string[]
  getDisplayName: (booking: T) => string
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
  telegramBotUsername,
  calendarActionText,
  isCancellable,
  bulkCancelFn,
  queryKey = ['bookings'],
  getDisplayName,
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
  const somePageSelected = bookings.some((booking) =>
    selectedIds.has(booking.id)
  )

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
          {telegramBotUsername && (
            <Button
              variant="default"
              size="sm"
              className="h-8 w-full sm:w-auto"
              asChild
            >
              <a
                href={createTelegramBotLink(telegramBotUsername)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Telegram bot to return equipment. Send /return_equipment command."
                className="flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Return Equipment
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="hidden items-center gap-3 px-4 text-xs font-medium text-muted-foreground md:flex">
        <div className={cn(SELECT_W, 'flex items-center')}>
          <Checkbox
            checked={allPageSelected || (somePageSelected && 'indeterminate')}
            onCheckedChange={(value) => toggleAllRows(!!value)}
            aria-label="Select all bookings on this page"
          />
        </div>
        <span className={ID_W}>ID</span>
        <span className="min-w-0 flex-1">Name</span>
        <div className={cn(START_W, 'flex justify-end')}>
          <SortableHeaderButton
            label="Start"
            column="startTime"
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSortChange={onSortChange}
          />
        </div>
        <div className={cn(END_W, 'flex justify-end')}>
          <SortableHeaderButton
            label="End"
            column="endTime"
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSortChange={onSortChange}
          />
        </div>
        <div className={cn(STATUS_W, 'flex justify-center')}>
          <SortableHeaderButton
            label="Status"
            column="status"
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSortChange={onSortChange}
          />
        </div>
        <span className={CHEVRON_W} />
      </div>

      <div className="relative space-y-2">
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
