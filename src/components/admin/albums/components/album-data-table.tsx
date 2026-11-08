import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { SortingState } from '@tanstack/react-table'
import { Flame, HardDrive, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { SearchInput } from '@/components/shared/search-input'
import { DataTableFacetedFilter } from '@/components/shared/data-table-faceted-filter'
import { DateRangeFilter } from '@/components/shared/date-range-filter'
import { ServerDataTablePagination } from '@/components/shared/data-table/server-data-table-pagination'
import { toDateOnlyString } from '@/lib/format'
import { ALBUM_STATUSES, ALBUM_STATUS_INFO } from '@/lib/albums/status'
import type { AdminAlbumRow } from '@/lib/albums/types'
import type { PaginationMeta } from '@/lib/pagination'
import { createAlbumColumns } from './album-columns'
import { OFFLOAD_ENABLED } from './album-table-types'
import type { AlbumTableFilters, OnBulkAction } from './album-table-types'

const statusOptions = ALBUM_STATUSES.map((value) => ({
  value,
  label: ALBUM_STATUS_INFO[value].label,
}))

const storageOptions = [
  { value: 'buffer', label: 'On Buffer' },
  { value: 'flamekeeper', label: 'By Flamekeepers' },
]

interface AlbumDataTableProps {
  albums: AdminAlbumRow[]
  pagination: PaginationMeta
  filters: AlbumTableFilters
  isLoading?: boolean
  selectionResetToken?: number
  onBulkAction: OnBulkAction
  onFiltersChange: (patch: Partial<AlbumTableFilters>) => void
}

export function AlbumDataTable({
  albums,
  pagination,
  filters,
  isLoading = false,
  selectionResetToken = 0,
  onBulkAction,
  onFiltersChange,
}: AlbumDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState<
    Record<string, boolean>
  >({})

  const columns = React.useMemo(
    () => createAlbumColumns({ onBulkAction }),
    [onBulkAction]
  )

  const sorting = React.useMemo<SortingState>(
    () => [{ id: filters.sortBy, desc: filters.sortOrder === 'desc' }],
    [filters.sortBy, filters.sortOrder]
  )

  const table = useReactTable({
    data: albums,
    columns,
    getRowId: (row) => row.id,
    state: {
      sorting,
      rowSelection,
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.limit,
      },
    },
    pageCount: pagination.totalPages,
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
    enableSortingRemoval: false,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      const sort = next[0]
      if (!sort) return
      onFiltersChange({
        sortBy: sort.id as AlbumTableFilters['sortBy'],
        sortOrder: sort.desc ? 'desc' : 'asc',
        page: 1,
      })
    },
    getCoreRowModel: getCoreRowModel(),
  })

  const resetSelection = table.resetRowSelection
  const resetKey = JSON.stringify([
    selectionResetToken,
    pagination.page,
    pagination.limit,
    filters.search,
    filters.status,
    filters.storage,
    filters.startDate,
    filters.endDate,
    filters.sortBy,
    filters.sortOrder,
  ])
  React.useEffect(() => {
    resetSelection()
  }, [resetKey, resetSelection])

  const selectedAlbums = albums.filter((album) => rowSelection[album.id])

  const isFiltered =
    !!filters.search ||
    !!filters.status?.length ||
    !!filters.storage?.length ||
    !!filters.startDate ||
    !!filters.endDate

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1">
          <SearchInput
            placeholder="Search title, description or owner..."
            value={filters.search}
            onChange={(value) =>
              onFiltersChange({ search: value || undefined, page: 1 })
            }
            className="h-8 w-full sm:w-[220px] lg:w-[300px]"
          />
          <div className="flex flex-wrap gap-2">
            <DataTableFacetedFilter
              title="Status"
              options={statusOptions}
              selectedValues={filters.status ?? []}
              onSelectionChange={(values) =>
                onFiltersChange({
                  status: values as AlbumTableFilters['status'],
                  page: 1,
                })
              }
            />
            <DataTableFacetedFilter
              title="Storage"
              options={storageOptions}
              selectedValues={filters.storage ?? []}
              onSelectionChange={(values) =>
                onFiltersChange({
                  storage: values as AlbumTableFilters['storage'],
                  page: 1,
                })
              }
            />
            <DateRangeFilter
              from={
                filters.startDate ? `${filters.startDate}T00:00:00` : undefined
              }
              to={filters.endDate ? `${filters.endDate}T00:00:00` : undefined}
              onChange={(range) =>
                onFiltersChange({
                  startDate: range?.from
                    ? toDateOnlyString(range.from)
                    : undefined,
                  endDate: range?.to ? toDateOnlyString(range.to) : undefined,
                  page: 1,
                })
              }
              className="w-full sm:w-auto"
            />
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() =>
                  onFiltersChange({
                    search: undefined,
                    status: undefined,
                    storage: undefined,
                    startDate: undefined,
                    endDate: undefined,
                    page: 1,
                  })
                }
                className="h-8 px-2 lg:px-3"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {selectedAlbums.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-dashed"
              onClick={() => onBulkAction('move-to-buffer', selectedAlbums)}
            >
              <HardDrive className="mr-2 h-4 w-4" />
              Move to Buffer ({selectedAlbums.length})
            </Button>
            {OFFLOAD_ENABLED && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-dashed"
                onClick={() =>
                  onBulkAction('move-to-flamekeeper', selectedAlbums)
                }
              >
                <Flame className="mr-2 h-4 w-4" />
                Move to Flamekeepers ({selectedAlbums.length})
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => onBulkAction('schedule-deletion', selectedAlbums)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Schedule deletion ({selectedAlbums.length})
            </Button>
          </div>
        )}
      </div>

      <div className="relative overflow-x-auto rounded-md border">
        {isLoading && <LoadingOverlay />}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap [&:has([role=checkbox])]:pl-3"
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="whitespace-nowrap [&:has([role=checkbox])]:pl-3"
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
                  No albums found.
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
        selectedCount={selectedAlbums.length}
        totalCount={pagination.totalCount}
        onPageChange={(page) => onFiltersChange({ page })}
        onPageSizeChange={(limit) => onFiltersChange({ limit, page: 1 })}
      />
    </div>
  )
}
