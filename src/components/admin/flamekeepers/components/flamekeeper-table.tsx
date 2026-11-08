import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type Updater,
} from '@tanstack/react-table'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableFacetedFilter } from '@/components/shared/data-table-faceted-filter'
import { ServerDataTablePagination } from '@/components/shared/data-table/server-data-table-pagination'
import { useServerTableSorting } from '@/components/shared/data-table/use-server-table-sorting'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { SearchInput } from '@/components/shared/search-input'
import {
  BanUserDialog,
  UnbanUserDialog,
} from '@/components/shared/ban-user-dialogs'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { createFlamekeeperColumns } from './flamekeeper-columns'
import { FLAMEKEEPER_STATUSES } from '../types'
import type { FlamekeeperTableFilters } from '../types'
import { flamekeeperStatus } from './state-badge'

const statusOptions = FLAMEKEEPER_STATUSES.map((status) => ({
  value: status,
  label: status,
}))

interface FlamekeeperTableProps {
  rows: AdminFlamekeeperRow[]
  filters: FlamekeeperTableFilters
  isLoading?: boolean
  canBan?: boolean
  viewerId?: string
}

export function FlamekeeperTable({
  rows,
  filters,
  isLoading = false,
  canBan = false,
  viewerId,
}: FlamekeeperTableProps) {
  const navigate = useNavigate()
  const [banUserId, setBanUserId] = React.useState<string | null>(null)
  const [unbanUserId, setUnbanUserId] = React.useState<string | null>(null)

  const { sorting, handleSortingChange } = useServerTableSorting(filters)

  const filteredRows = React.useMemo(() => {
    if (!filters.status || filters.status.length === 0) return rows
    return rows.filter((fk) => filters.status!.includes(flamekeeperStatus(fk)))
  }, [rows, filters.status])

  const columns = React.useMemo(
    () =>
      createFlamekeeperColumns({
        onBan: (row) => setBanUserId(row.userId),
        onUnban: (row) => setUnbanUserId(row.userId),
        canBan,
        viewerId,
      }),
    [canBan, viewerId]
  )

  const handlePaginationChange = React.useCallback(
    (updater: Updater<PaginationState>) => {
      const current: PaginationState = {
        pageIndex: filters.page - 1,
        pageSize: filters.limit,
      }
      const next = typeof updater === 'function' ? updater(current) : updater

      navigate({
        to: '.',
        search: {
          ...filters,
          page: next.pageIndex + 1,
          limit: next.pageSize,
        },
      })
    },
    [filters, navigate]
  )

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: filters.page - 1,
        pageSize: filters.limit,
      },
    },
    getRowId: (row) => row.userId,
    enableSortingRemoval: false,
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const pageCount = Math.max(1, table.getPageCount())

  React.useEffect(() => {
    if (filters.page > pageCount) {
      navigate({
        to: '.',
        search: { ...filters, page: pageCount },
      })
    }
  }, [filters, navigate, pageCount])

  const handleSearchChange = (value: string) => {
    navigate({
      to: '.',
      search: {
        ...filters,
        search: value || undefined,
        page: 1,
      },
    })
  }

  const handleStatusChange = (values: string[] | undefined) => {
    navigate({
      to: '.',
      search: {
        ...filters,
        status: values && values.length > 0 ? values : undefined,
        page: 1,
      },
    })
  }

  const handlePageChange = (page: number) => {
    navigate({
      to: '.',
      search: { ...filters, page },
    })
  }

  const handlePageSizeChange = (limit: number) => {
    navigate({
      to: '.',
      search: { ...filters, limit, page: 1 },
    })
  }

  const isFiltered =
    (filters.status && filters.status.length > 0) || Boolean(filters.search)

  const clearAllFilters = () => {
    navigate({
      to: '.',
      search: {
        page: 1,
        limit: filters.limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    })
  }

  const banRow = rows.find((row) => row.userId === banUserId)
  const unbanRow = rows.find((row) => row.userId === unbanUserId)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          placeholder="Search flamekeepers by name or email..."
          value={filters.search}
          onChange={handleSearchChange}
          className="h-8 w-full sm:w-[280px]"
        />
        <DataTableFacetedFilter
          title="Status"
          options={statusOptions}
          selectedValues={filters.status || []}
          onSelectionChange={handleStatusChange}
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

      <div className="relative overflow-x-auto rounded-md border">
        {isLoading && <LoadingOverlay />}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
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
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    if (
                      target.closest(
                        'button, a, input, select, label, [role="combobox"]'
                      )
                    )
                      return
                    navigate({
                      to: '/admin/flamekeepers/$userId',
                      params: { userId: row.original.userId },
                    })
                  }}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
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
                  className="h-24 text-center text-muted-foreground"
                >
                  No flamekeepers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ServerDataTablePagination
        page={Math.min(filters.page, pageCount)}
        totalPages={pageCount}
        limit={filters.limit}
        totalCount={filteredRows.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {banRow && (
        <BanUserDialog
          userId={banRow.userId}
          userName={banRow.name}
          open
          onOpenChange={(open) => !open && setBanUserId(null)}
        />
      )}
      {unbanRow && (
        <UnbanUserDialog
          userId={unbanRow.userId}
          userName={unbanRow.name}
          open
          onOpenChange={(open) => !open && setUnbanUserId(null)}
        />
      )}
    </div>
  )
}
