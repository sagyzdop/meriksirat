import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { DataTableFacetedFilter } from '@/components/shared/data-table-faceted-filter'
import { ServerDataTablePagination } from '@/components/shared/data-table/server-data-table-pagination'
import { useServerTableSorting } from '@/components/shared/data-table/use-server-table-sorting'
import { createBirthdayColumns } from './birthday-columns'
import { X } from 'lucide-react'

import type {
  BirthdayListFilters,
  BirthdayPagination,
  BirthdayUser,
} from '@/lib/birthdays/types'

interface BirthdayDataTableProps {
  columns?: ColumnDef<BirthdayUser>[]
  data: BirthdayUser[]
  pagination: BirthdayPagination
  filters: BirthdayListFilters
  isLoading?: boolean
}

const congratulationOptions = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

export function BirthdayDataTable({
  columns: providedColumns,
  data,
  pagination,
  filters,
  isLoading = false,
}: BirthdayDataTableProps) {
  const navigate = useNavigate()
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )

  const { sorting, handleSortingChange } = useServerTableSorting(filters)

  const columns = React.useMemo(
    () => providedColumns || createBirthdayColumns(),
    [providedColumns]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
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
    enableSortingRemoval: false,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // Handle search input changes
  const handleSearchChange = React.useCallback(
    (value: string) => {
      navigate({
        to: '.',
        search: {
          ...filters,
          search: value || undefined,
          page: 1,
        },
      })
    },
    [filters, navigate]
  )

  // Handle filter changes
  const handleFilterChange = React.useCallback(
    (filterId: string, value: string[] | undefined) => {
      if (filterId === 'wantsCongratulation') {
        navigate({
          to: '.',
          search: {
            ...filters,
            wantsCongratulation:
              value && value.length > 0
                ? value.map((v) => v === 'true')
                : undefined,
            page: 1,
          },
        })
      }
    },
    [filters, navigate]
  )

  // Handle pagination changes
  const handlePageChange = React.useCallback(
    (newPage: number) => {
      navigate({
        to: '.',
        search: { ...filters, page: newPage },
      })
    },
    [filters, navigate]
  )

  // Handle page size changes
  const handlePageSizeChange = React.useCallback(
    (newPageSize: number) => {
      navigate({
        to: '.',
        search: { ...filters, limit: newPageSize, page: 1 },
      })
    },
    [filters, navigate]
  )

  const isFiltered =
    (filters.wantsCongratulation &&
      filters.wantsCongratulation.length > 0) ||
    filters.search

  const clearAllFilters = React.useCallback(() => {
    navigate({
      to: '.',
      search: {
        page: 1,
        limit: filters.limit,
        sortBy: 'occurrence',
        sortOrder: 'asc',
      },
    })
  }, [filters.limit, navigate])

  return (
    <div className="space-y-4">
      {/* Filters - Responsive layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1">
          <Input
            placeholder="Search members by name or email..."
            value={filters.search || ''}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="h-8 w-full sm:w-[200px] lg:w-[300px]"
          />
          <div className="flex flex-wrap gap-2">
            <DataTableFacetedFilter
              title="Congratulate"
              options={congratulationOptions}
              selectedValues={(
                filters.wantsCongratulation || []
              ).map(String)}
              onSelectionChange={(values) =>
                handleFilterChange('wantsCongratulation', values)
              }
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
                    <TableHead
                      key={header.id}
                      className="[&:has([role=checkbox])]:pl-3 whitespace-nowrap"
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
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    if (
                      target.closest(
                        'button, a, input, select, label, [role="combobox"]'
                      )
                    )
                      return
                    navigate({
                      to: '/admin/users/$userId',
                      params: { userId: row.original.id },
                    })
                  }}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="[&:has([role=checkbox])]:pl-3 whitespace-nowrap"
                    >
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

      <ServerDataTablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        limit={pagination.limit}
        totalCount={pagination.totalCount}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
