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
import { useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"

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
import { LoadingOverlay } from "@/components/shared/loading-overlay"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTableFacetedFilter } from "@/components/shared/data-table-faceted-filter"
import { createUserColumns } from "./user-columns"
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Shield } from "lucide-react"
import { BulkEditClearanceDialog } from "@/components/shared/bulk-edit-clearance-dialog"

import { bulkUpdateUserClearanceFn } from "@/lib/user/functions"
import { User } from "@/lib/user/types"

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

interface Filters {
  role?: string[]
  status?: string[]
  clearanceLevel?: number[]
  search?: string
  page: number
  limit: number
  sortBy: 'firstName' | 'lastName' | 'email' | 'role' | 'status' | 'clearanceLevel' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface UserDataTableProps {
  columns?: ColumnDef<User>[]
  data: User[]
  pagination: Pagination
  filters: Filters
  isLoading?: boolean
}

const roleOptions = [
  { value: "user", label: "User" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
]

const statusOptions = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "On Probation", label: "On Probation" },
  { value: "Board", label: "Board" },
  { value: "Ex-Board", label: "Ex-Board" },
  { value: "Roommate", label: "Roommate" },
  { value: "Ex-Roommate", label: "Ex-Roommate" },
  { value: "Graduated", label: "Graduated" },
]

const clearanceLevelOptions = [...Array(10)].map((_, i) => ({
  value: (i + 1).toString(),
  label: `Level ${i + 1}`,
}))

export function UserDataTable({
  columns: providedColumns,
  data,
  pagination,
  filters,
  isLoading = false,
}: UserDataTableProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [rowSelection, setRowSelection] = React.useState({})
  const [bulkEditClearanceOpen, setBulkEditClearanceOpen] = React.useState(false)
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  // Controlled sorting state - sync with URL params
  const [sorting, setSorting] = React.useState<SortingState>([{
    id: filters.sortBy,
    desc: filters.sortOrder === 'desc'
  }])

  // Create columns
  const columns = React.useMemo(
    () => providedColumns || createUserColumns(),
    [providedColumns]
  )

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

  // Handle search input changes
  const handleSearchChange = React.useCallback((value: string) => {
    navigate({
      to: '.',
      search: {
        ...filters,
        search: value || undefined,
        page: 1,
      },
    })
  }, [filters, navigate])

  // Handle filter changes
  const handleFilterChange = React.useCallback((filterId: string, value: string[] | undefined) => {
    if (filterId === 'role' || filterId === 'status') {
      navigate({
        to: '.',
        search: {
          ...filters,
          [filterId]: (value && value.length > 0) ? value : undefined,
          page: 1,
        },
      })
    } else if (filterId === 'clearanceLevel') {
      navigate({
        to: '.',
        search: {
          ...filters,
          clearanceLevel: (value && value.length > 0) ? value.map(Number) : undefined,
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

  const isFiltered = (filters.role && filters.role.length > 0) || (filters.status && filters.status.length > 0) || (filters.clearanceLevel && filters.clearanceLevel.length > 0) || filters.search

  const clearAllFilters = React.useCallback(() => {
    navigate({
      to: '.',
      search: {
        page: 1,
        limit: filters.limit,
        sortBy: 'firstName',
        sortOrder: 'asc',
      },
    })
  }, [filters.limit, navigate])

  const selectedUserIds = React.useMemo(() => {
    return Object.keys(rowSelection).map(index => data[parseInt(index)]?.id).filter(Boolean)
  }, [rowSelection, data])

  return (
    <div className="space-y-4">
      {/* Filters - Responsive layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1">
          <Input
            placeholder="Search users by name or email..."
            value={filters.search || ""}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="h-8 w-full sm:w-[200px] lg:w-[300px]"
          />
          <div className="flex flex-wrap gap-2">
            <DataTableFacetedFilter
              title="Role"
              options={roleOptions}
              selectedValues={filters.role || []}
              onSelectionChange={(values) => handleFilterChange('role', values)}
            />
            <DataTableFacetedFilter
              title="Status"
              options={statusOptions}
              selectedValues={filters.status || []}
              onSelectionChange={(values) => handleFilterChange('status', values)}
            />
            <DataTableFacetedFilter
              title="Clearance Level"
              options={clearanceLevelOptions}
              selectedValues={filters.clearanceLevel ? filters.clearanceLevel.map(String) : []}
              onSelectionChange={(values) => handleFilterChange('clearanceLevel', values)}
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
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {selectedUserIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full border-dashed sm:w-auto"
              onClick={() => setBulkEditClearanceOpen(true)}
            >
              <Shield className="mr-2 h-4 w-4" />
              Edit Clearance ({selectedUserIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* Table with horizontal scroll on small screens */}
      <div className="relative rounded-md border overflow-x-auto">
        {isLoading && <LoadingOverlay />}
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    if (target.closest('button, a, input, select, label, [role="combobox"]')) return
                    navigate({
                      to: '/admin/users/$userId',
                      params: { userId: row.original.id },
                    })
                  }}
                  className="cursor-pointer"
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

      {/* Pagination - Responsive layout */}
      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedUserIds.length} of{" "}
          {pagination.totalCount} row(s) selected.
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

      <BulkEditClearanceDialog
        open={bulkEditClearanceOpen}
        onOpenChange={setBulkEditClearanceOpen}
        count={selectedUserIds.length}
        itemNoun="user(s)"
        actionPhrase="update the clearance level"
        successMessage={`Updated clearance level for ${selectedUserIds.length} user(s)`}
        errorTitle="Failed to update users"
        onSubmit={async (clearanceLevel) => {
          await bulkUpdateUserClearanceFn({
            data: { userIds: selectedUserIds, clearanceLevel },
          })
        }}
        onSuccess={() => {
          table.resetRowSelection()
          queryClient.invalidateQueries({ queryKey: ['users'] })
        }}
      />
    </div>
  )
}