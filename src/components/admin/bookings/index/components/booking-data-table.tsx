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
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar } from "lucide-react"
import type { AdminBookingWithDetails } from "@/lib/booking/types"
import { cn } from "@/lib/utils"
import { isPast } from "date-fns"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Filters {
  status?: 'booked' | 'active' | 'returned' | 'cancelled' | 'overdue'
  userId?: string
  equipmentId?: number
  startDate?: string
  endDate?: string
  search?: string
  page: number
  limit: number
  sortBy: 'startTime' | 'endTime' | 'status' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface BookingDataTableProps {
  columns: ColumnDef<AdminBookingWithDetails>[]
  data: AdminBookingWithDetails[]
  pagination: Pagination
  filters: Filters
}

const statusOptions = [
  { value: "booked", label: "Booked" },
  { value: "active", label: "Active" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
  { value: "overdue", label: "Overdue" },
]

export function BookingDataTable({ columns, data, pagination, filters }: BookingDataTableProps) {
  const navigate = useNavigate()
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])

  // Count overdue bookings in current data
  const overdueCount = React.useMemo(() => {
    return data.filter(booking => 
      isPast(new Date(booking.endTime)) && 
      (booking.status === 'booked' || booking.status === 'active')
    ).length
  }, [data])

  // Initialize filters from URL params
  React.useEffect(() => {
    const initialFilters: ColumnFiltersState = []
    
    if (filters.status) {
      initialFilters.push({ id: "status", value: [filters.status] })
    }
    
    if (filters.search) {
      initialFilters.push({ id: "search", value: filters.search })
    }
    
    setColumnFilters(initialFilters)
    
    // Set initial sorting
    setSorting([{
      id: filters.sortBy,
      desc: filters.sortOrder === 'desc'
    }])
  }, [filters])

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
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // Handle search input changes
  const handleSearchChange = React.useCallback((value: string) => {
    const newFilters = { ...filters }
    if (value) {
      newFilters.search = value
    } else {
      delete newFilters.search
    }
    newFilters.page = 1 // Reset to first page
    
    navigate({
      to: '/admin/bookings',
      search: newFilters,
    })
  }, [filters, navigate])

  // Handle filter changes
  const handleFilterChange = React.useCallback((filterId: string, values: string[] | undefined) => {
    const newFilters = { ...filters }
    
    if (filterId === 'status') {
      if (values && values.length > 0) {
        newFilters.status = values[0] as any
      } else {
        delete newFilters.status
      }
    }
    
    newFilters.page = 1 // Reset to first page
    
    navigate({
      to: '/admin/bookings',
      search: newFilters,
    })
  }, [filters, navigate])

  // Handle date range filters
  const handleDateFilterChange = React.useCallback((type: 'startDate' | 'endDate', value: string) => {
    const newFilters = { ...filters }
    
    if (value) {
      newFilters[type] = value
    } else {
      delete newFilters[type]
    }
    
    newFilters.page = 1 // Reset to first page
    
    navigate({
      to: '/admin/bookings',
      search: newFilters,
    })
  }, [filters, navigate])

  // Handle pagination changes
  const handlePageChange = React.useCallback((newPage: number) => {
    navigate({
      to: '/admin/bookings',
      search: { ...filters, page: newPage },
    })
  }, [filters, navigate])

  // Handle page size changes
  const handlePageSizeChange = React.useCallback((newPageSize: number) => {
    navigate({
      to: '/admin/bookings',
      search: { ...filters, limit: newPageSize, page: 1 },
    })
  }, [filters, navigate])

  // Handle sorting changes
  React.useEffect(() => {
    if (sorting.length > 0) {
      const sort = sorting[0]
      const newFilters = {
        ...filters,
        sortBy: sort.id as any,
        sortOrder: sort.desc ? 'desc' as const : 'asc' as const,
        page: 1, // Reset to first page
      }
      
      navigate({
        to: '/admin/bookings',
        search: newFilters,
      })
    }
  }, [sorting])

  const isFiltered = filters.status || filters.search || filters.startDate || filters.endDate

  const clearAllFilters = React.useCallback(() => {
    navigate({
      to: '/admin/bookings',
      search: {
        page: 1,
        limit: filters.limit,
        sortBy: 'startTime',
        sortOrder: 'desc',
      },
    })
  }, [filters.limit, navigate])

  return (
    <div className="space-y-4">
      {overdueCount > 0 && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              {overdueCount} overdue booking{overdueCount === 1 ? '' : 's'} detected on this page
            </p>
          </div>
        </div>
      )}
      
      {/* Filters - Responsive layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1">
          <Input
            placeholder="Search by user, email, or equipment..."
            value={filters.search || ""}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="h-8 w-full sm:w-[200px] lg:w-[300px]"
          />
          <div className="flex flex-wrap gap-2">
            <DataTableFacetedFilter
              title="Status"
              options={statusOptions}
              selectedValues={filters.status ? [filters.status] : []}
              onSelectionChange={(values) => handleFilterChange('status', values)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                placeholder="Start date"
                value={filters.startDate || ""}
                onChange={(event) => handleDateFilterChange('startDate', event.target.value)}
                className="h-8 w-full sm:w-[150px]"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                placeholder="End date"
                value={filters.endDate || ""}
                onChange={(event) => handleDateFilterChange('endDate', event.target.value)}
                className="h-8 w-full sm:w-[150px]"
              />
            </div>
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
      
      {/* Table with horizontal scroll on small screens */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="[&:has([role=checkbox])]:pl-3 whitespace-nowrap">
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
              table.getRowModel().rows.map((row) => {
                const booking = row.original
                const isOverdue = isPast(new Date(booking.endTime)) && 
                  (booking.status === 'booked' || booking.status === 'active')
                
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      isOverdue && "bg-destructive/5 hover:bg-destructive/10"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="[&:has([role=checkbox])]:pl-3 whitespace-nowrap">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
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
              <SelectTrigger className="h-8 w-[70px]">
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
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
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
