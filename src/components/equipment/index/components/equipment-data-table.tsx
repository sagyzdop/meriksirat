import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table"
import { useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTableLoading } from "@/components/data-table/data-table-loading"
import { Equipment } from "./types"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Filters {
  categoryIds?: number[]
  searchQuery?: string
  page: number
  limit: number
  sortBy: 'modelName' | 'category' | 'requiredClearanceLevel' | 'isActive' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface EquipmentDataTableProps {
  columns: ColumnDef<Equipment>[]
  data: Equipment[]
  pagination: Pagination
  filters: Filters
  isLoading?: boolean
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
  selectedCount: number
  onBookSelected?: () => void
  onClearSelection?: () => void
}

export function EquipmentDataTable({
  columns,
  data,
  pagination,
  filters,
  isLoading = false,
  rowSelection,
  onRowSelectionChange,
  selectedCount,
  onBookSelected,
  onClearSelection,
}: EquipmentDataTableProps) {
  const navigate = useNavigate()
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
        search: (prev) => ({
          ...prev,
          sortBy: sort.id as any,
          sortOrder: sort.desc ? 'desc' as const : 'asc' as const,
          page: 1,
        }),
      })
    }
  }, [filters.sortBy, filters.sortOrder, navigate])

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
    getRowId: (row) => row.id.toString(),
    onRowSelectionChange,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const handleRowClick = (equipmentId: number) => {
    navigate({
      to: "/equipment/$",
      params: { _splat: equipmentId.toString() }
    })
  }

  return (
    <div className="space-y-4">
      {(onBookSelected || onClearSelection) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {selectedCount} selected
          </div>
          <div className="flex items-center gap-2">
            {onClearSelection && selectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearSelection}
              >
                Clear selection
              </Button>
            )}
            {onBookSelected && (
              <Button
                size="sm"
                onClick={onBookSelected}
                disabled={selectedCount === 0}
              >
                Book selected
              </Button>
            )}
          </div>
        </div>
      )}
      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        {isLoading && <DataTableLoading />}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isImageColumn = header.column.id === "image"
                  return (
                    <TableHead
                      key={header.id}
                      className={`whitespace-nowrap h-12 [&:has([role=checkbox])]:pl-3${isImageColumn ? " w-16 min-w-16" : ""}`}
                    >
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
                  className="cursor-pointer h-16"
                >
                  {row.getVisibleCells().map((cell) => {
                    const isImageColumn = cell.column.id === "image"
                    return (
                      <TableCell
                        key={cell.id}
                        className={`whitespace-nowrap py-3 [&:has([role=checkbox])]:pl-3${isImageColumn ? " w-16 min-w-16" : ""}`}
                      >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No equipment found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground px-2">
        {selectedCount} of {pagination.total} row(s) selected.
      </div>
    </div>
  )
}

