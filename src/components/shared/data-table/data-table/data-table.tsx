/**
 * DataTable Component
 *
 * A responsive data table component that displays data in a table format on desktop
 * and switches to a card-based layout on mobile devices.
 *
 * Features:
 * - Desktop: Full table with sorting, filtering, and pagination
 * - Mobile: Card-based layout with all relevant data
 * - Loading states with skeleton placeholders
 * - Empty states with customizable messages
 * - Optional custom mobile card renderer
 *
 * Usage:
 * ```tsx
 * import { DataTable } from '@/components/data-table/data-table'
 * import { columns } from './columns'
 *
 * <DataTable
 *   columns={columns}
 *   data={data}
 *   loading={isLoading}
 *   emptyMessage="No equipment found"
 *   renderMobileCard={(equipment) => (
 *     <Card>
 *       <CardHeader>
 *         <CardTitle>{equipment.modelName}</CardTitle>
 *       </CardHeader>
 *       <CardContent>
 *         <p>{equipment.description}</p>
 *       </CardContent>
 *     </Card>
 *   )}
 * />
 * ```
 *
 * Requirements: 2.4, 7.4
 * @see https://ui.shadcn.com/docs/components/data-table
 * @see https://ui.shadcn.com/docs/components/card
 */
import * as React from 'react'
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
} from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'

/**
 * Props for the DataTable component
 *
 * @template TData - The type of data in the table
 * @template TValue - The type of values in the table cells
 */
export interface DataTableProps<TData, TValue> {
  /** Column definitions for the table */
  columns: ColumnDef<TData, TValue>[]
  /** Data to display in the table */
  data: TData[]
  /** Optional callback when a row is clicked */
  onRowClick?: (row: TData) => void
  /** Whether the table is in a loading state */
  loading?: boolean
  /** Message to display when there are no results */
  emptyMessage?: string
  /** Initial page size for pagination */
  pageSize?: number
  /**
   * Optional custom renderer for mobile card view
   * If not provided, a default card layout will be used
   *
   * @example
   * renderMobileCard={(equipment) => (
   *   <Card>
   *     <CardHeader>
   *       <CardTitle>{equipment.modelName}</CardTitle>
   *       <CardDescription>{equipment.category?.name}</CardDescription>
   *     </CardHeader>
   *     <CardContent>
   *       <Badge>{equipment.isActive ? 'Active' : 'Inactive'}</Badge>
   *     </CardContent>
   *   </Card>
   * )}
   */
  renderMobileCard?: (row: TData) => React.ReactNode
}

/**
 * DataTable component that provides responsive table/card views
 *
 * Displays a table on desktop (md breakpoint and above) and cards on mobile.
 * Includes built-in loading and empty states.
 *
 * @template TData - The type of data in the table
 * @template TValue - The type of values in the table cells
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = 'No results.',
  pageSize = 10,
  renderMobileCard,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
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

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Desktop table skeleton */}
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((_, index) => (
                  <TableHead key={index}>
                    <Skeleton className="h-4 w-full" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile card skeleton */}
        <div className="md:hidden space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (!loading && table.getRowModel().rows?.length === 0) {
    return (
      <div className="space-y-4">
        {/* Desktop empty state */}
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="[&:has([role=checkbox])]:pl-3"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <Empty title={emptyMessage} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Mobile empty state */}
        <div className="md:hidden">
          <Empty title={emptyMessage} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table View - hidden on mobile */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
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
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                onClick={() => onRowClick?.(row.original)}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="[&:has([role=checkbox])]:pl-3 whitespace-nowrap"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View - hidden on desktop */}
      <div className="md:hidden space-y-4">
        {table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            onClick={() => onRowClick?.(row.original)}
            className={onRowClick ? 'cursor-pointer' : undefined}
          >
            {renderMobileCard ? (
              renderMobileCard(row.original)
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {
                      row
                        .getVisibleCells()
                        .find(
                          (cell) =>
                            !cell.column.id.includes('select') &&
                            !cell.column.id.includes('actions')
                        )?.column.columnDef.header as string
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {row
                    .getVisibleCells()
                    .filter(
                      (cell) =>
                        !cell.column.id.includes('select') &&
                        !cell.column.id.includes('actions')
                    )
                    .map((cell) => {
                      const header = table
                        .getHeaderGroups()[0]
                        ?.headers.find((h) => h.column.id === cell.column.id)
                      return (
                        <div key={cell.id} className="flex flex-col space-y-1">
                          {header && (
                            <span className="text-sm font-medium text-muted-foreground">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                          )}
                          <span className="text-sm">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </span>
                        </div>
                      )
                    })}
                  {row
                    .getVisibleCells()
                    .find((cell) => cell.column.id.includes('actions')) && (
                    <div className="pt-2 border-t">
                      {flexRender(
                        row
                          .getVisibleCells()
                          .find((cell) => cell.column.id.includes('actions'))!
                          .column.columnDef.cell,
                        row
                          .getVisibleCells()
                          .find((cell) => cell.column.id.includes('actions'))!
                          .getContext()
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
