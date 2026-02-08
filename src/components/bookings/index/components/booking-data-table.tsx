import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table"
import { useNavigate, useRouter } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LoadingOverlay } from "@/components/shared/loading-overlay"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BookingWithEquipment } from "@/lib/booking/types"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { X, MessageCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { createTelegramBotLink } from "@/lib/telegram/client-utils"
import { cancelBookingFn, updateBookingsTimeFn } from "@/lib/booking"
import { BulkChangeTimeDialog } from "@/components/bookings/components/bulk-change-time-dialog"
import { BulkCancelBookingsDialog } from "@/components/bookings/components/bulk-cancel-bookings-dialog"
import { toast } from "sonner"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Filters {
  status?: string[]
  equipmentId?: number
  startDate?: string
  endDate?: string
  page: number
  limit: number
  sortBy: 'startTime' | 'endTime' | 'status' | 'createdAt' | 'equipment'
  sortOrder: 'asc' | 'desc'
}

interface BookingDataTableProps {
  columns: ColumnDef<BookingWithEquipment>[]
  data: BookingWithEquipment[]
  pagination: Pagination
  filters: Filters
  telegramBotUsername: string
  isLoading?: boolean
}

const statusOptions = [
  { value: "booked", label: "Booked" },
  { value: "active", label: "Active" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
  { value: "overdue", label: "Overdue" },
]

export function BookingDataTable({
  columns,
  data,
  pagination,
  filters,
  telegramBotUsername,
  isLoading = false,
}: BookingDataTableProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const [rowSelection, setRowSelection] = React.useState({})
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false)
  const [bulkCancelOpen, setBulkCancelOpen] = React.useState(false)
  const [isBulkCancelling, setIsBulkCancelling] = React.useState(false)
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  // Controlled sorting state - sync with URL params
  const [sorting, setSorting] = React.useState<SortingState>([{
    id: filters.sortBy,
    desc: filters.sortOrder === 'desc'
  }])

  // Sync sorting state with URL params when they change
  React.useEffect(() => {
    setSorting([{
      id: filters.sortBy,
      desc: filters.sortOrder === 'desc'
    }])
  }, [filters.sortBy, filters.sortOrder])

  // Handle sorting changes - navigate to update URL
  const handleSortingChange = React.useCallback((updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    // Get the current sorting state from URL params (source of truth)
    const currentSorting: SortingState = [{
      id: filters.sortBy,
      desc: filters.sortOrder === 'desc'
    }]

    const newSorting = typeof updaterOrValue === 'function' ? updaterOrValue(currentSorting) : updaterOrValue

    if (newSorting.length > 0) {
      const sort = newSorting[0]
      navigate({
        to: '.',
        search: {
          ...filters,
          sortBy: sort.id as any,
          sortOrder: sort.desc ? 'desc' : 'asc',
          page: 1,
        },
      })
    }
  }, [filters, navigate])

  const handleRowClick = (bookingId: number) => {
    navigate({
      to: "/bookings/$bookingId",
      params: { bookingId: bookingId.toString() }
    })
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.limit,
      },
    },
    pageCount: pagination.totalPages,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    enableSortingRemoval: false,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // Handle filter changes
  const handleFilterChange = React.useCallback((filterId: string, values: string[] | undefined) => {
    if (filterId === 'status') {
      navigate({
        to: '.',
        search: {
          ...filters,
          status: (values && values.length > 0) ? values : undefined,
          page: 1,
        },
      })
    }
  }, [filters, navigate])

  // Handle pagination changes
  const handlePageChange = React.useCallback((newPage: number) => {
    navigate({
      to: '.',
      search: { ...filters, page: newPage },
    })
  }, [filters, navigate])

  // Handle page size changes
  const handlePageSizeChange = React.useCallback((newPageSize: number) => {
    navigate({
      to: '.',
      search: { ...filters, limit: newPageSize, page: 1 },
    })
  }, [filters, navigate])

  const isFiltered = filters.status && filters.status.length > 0

  const selectedBookings = React.useMemo(() => {
    return Object.keys(rowSelection)
      .map((index) => data[parseInt(index)])
      .filter(Boolean)
  }, [rowSelection, data])

  const selectedBookingIds = React.useMemo(() => {
    return selectedBookings.map((booking) => booking.id)
  }, [selectedBookings])

  const cancellableBookings = React.useMemo(() => {
    return selectedBookings.filter((booking) =>
      booking.status === "booked" || booking.status === "active"
    )
  }, [selectedBookings])

  const cancellableBookingIds = React.useMemo(() => {
    return cancellableBookings.map((booking) => booking.id)
  }, [cancellableBookings])

  const handleBulkTimeUpdate = async (startTime: string, endTime: string) => {
    if (selectedBookingIds.length === 0) return
    await updateBookingsTimeFn({
      data: {
        bookingIds: selectedBookingIds,
        startTime,
        endTime,
      },
    })
    await router.invalidate()
  }

  const handleBulkCancel = async () => {
    if (cancellableBookingIds.length === 0) return

    setIsBulkCancelling(true)
    const results = await Promise.allSettled(
      cancellableBookingIds.map((bookingId) =>
        cancelBookingFn({ data: { bookingId } })
      )
    )

    const successCount = results.filter((result) => result.status === "fulfilled").length
    const failedCount = results.length - successCount

    if (successCount > 0) {
      toast.success(`Cancelled ${successCount} booking${successCount === 1 ? "" : "s"}`)
      setRowSelection({})
      await router.invalidate()
    }

    if (failedCount > 0) {
      toast.error("Some bookings could not be cancelled", {
        description: `Failed to cancel ${failedCount} booking${failedCount === 1 ? "" : "s"}.`,
      })
    }

    setIsBulkCancelling(false)
    setBulkCancelOpen(false)
  }

  const clearAllFilters = () => {
    navigate({
      to: '.',
      search: {
        page: 1,
        limit: filters.limit,
        sortBy: 'startTime',
        sortOrder: 'desc',
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters - Responsive layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DataTableFacetedFilter
              title="Status"
              options={statusOptions}
              selectedValues={filters.status || []}
              onSelectionChange={(values) => handleFilterChange('status', values)}
            />
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                className="h-8 px-2 lg:px-3"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full sm:w-auto"
            disabled={selectedBookingIds.length === 0}
            onClick={() => setBulkDialogOpen(true)}
          >
            Change Time
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 w-full sm:w-auto"
            disabled={cancellableBookingIds.length === 0}
            onClick={() => setBulkCancelOpen(true)}
          >
            Cancel Selected
          </Button>
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
              title="Open Telegram bot to return equipment. Send /end_booking command."
              className="flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Return Equipment
            </a>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-full sm:w-auto">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <BulkChangeTimeDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        bookings={selectedBookings}
        onConfirm={handleBulkTimeUpdate}
      />

      <BulkCancelBookingsDialog
        open={bulkCancelOpen}
        onOpenChange={setBulkCancelOpen}
        cancellableCount={cancellableBookingIds.length}
        totalSelectedCount={selectedBookingIds.length}
        isProcessing={isBulkCancelling}
        onConfirm={handleBulkCancel}
        calendarActionText="remove their calendar events"
      />

      {/* Table with horizontal scroll on small screens */}
      <div className="relative rounded-md border">
        {isLoading && <LoadingOverlay />}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="[&:has([role=checkbox])]:pl-3">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => handleRowClick(row.original.id)}
                    className="cursor-pointer"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="[&:has([role=checkbox])]:pl-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination - Responsive layout */}
      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {pagination.total} row(s) selected.
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium whitespace-nowrap">Rows per page</p>
            <Select
              value={`${pagination.limit}`}
              onValueChange={(value) => handlePageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-17.5">
                <SelectValue placeholder={pagination.limit} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between sm:justify-center gap-2">
            <div className="flex w-25 items-center justify-center text-sm font-medium">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page <= 1}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}