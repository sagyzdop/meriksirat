// PROTOTYPE: the variant A data table, with bulk selection and the clearance
// dialog removed. Filters, sorting, pagination and row click stay.
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
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
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableFacetedFilter } from '@/components/shared/data-table-faceted-filter'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { SearchInput } from '@/components/shared/search-input'
import { useServerTableSorting } from '@/components/shared/data-table/use-server-table-sorting'
import {
  BanUserDialog,
  UnbanUserDialog,
} from '@/components/shared/ban-user-dialogs'
import { updateUserAdminFn } from '@/lib/user'
import { USER_STATUSES } from '@/lib/user/types'
import { errorMessage } from '@/lib/utils'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { createFlamekeeperColumns } from './flamekeeper-columns'
import type { FlamekeeperTableFilters } from '../types'

const statusOptions = USER_STATUSES.map((status) => ({
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
  const queryClient = useQueryClient()
  const [banUserId, setBanUserId] = React.useState<string | null>(null)
  const [unbanUserId, setUnbanUserId] = React.useState<string | null>(null)

  const { sorting, handleSortingChange } = useServerTableSorting(filters)

  const filteredRows = React.useMemo(() => {
    const needle = filters.search?.trim().toLowerCase()
    return rows.filter((fk) => {
      if (needle) {
        const haystack = `${fk.name} ${fk.email}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (
        filters.status &&
        filters.status.length > 0 &&
        !filters.status.includes(fk.status ?? '')
      ) {
        return false
      }
      return true
    })
  }, [rows, filters.search, filters.status])

  const handleUpdateStatus = React.useCallback(
    async (userId: string, status: string) => {
      try {
        await updateUserAdminFn({
          data: {
            userId,
            status: status as (typeof USER_STATUSES)[number],
          },
        })
        await queryClient.invalidateQueries({ queryKey: ['flamekeepers'] })
        await queryClient.invalidateQueries({ queryKey: ['users'] })
        toast.success('Status updated')
      } catch (error) {
        toast.error('Failed to update status', {
          description: errorMessage(error, 'An error occurred'),
        })
      }
    },
    [queryClient]
  )

  const columns = React.useMemo(
    () =>
      createFlamekeeperColumns({
        onUpdateStatus: handleUpdateStatus,
        onBan: (row) => setBanUserId(row.userId),
        onUnban: (row) => setUnbanUserId(row.userId),
        canBan,
        viewerId,
      }),
    [handleUpdateStatus, canBan, viewerId]
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
        variant: filters.variant,
      },
    })
  }

  const banRow = rows.find((row) => row.userId === banUserId)
  const unbanRow = rows.find((row) => row.userId === unbanUserId)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          placeholder="Search name or email..."
          value={filters.search}
          onChange={handleSearchChange}
          className="h-8 w-full sm:w-[220px] lg:w-[280px]"
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

      <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredRows.length}{' '}
          {filteredRows.length === 1 ? 'flamekeeper' : 'flamekeepers'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select
              value={String(filters.limit)}
              onValueChange={(value) =>
                handlePaginationChange({
                  pageIndex: 0,
                  pageSize: Number(value),
                })
              }
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-muted-foreground">
            Page {Math.min(filters.page, pageCount)} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handlePaginationChange({
                  pageIndex: Math.max(0, filters.page - 2),
                  pageSize: filters.limit,
                })
              }
              disabled={filters.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handlePaginationChange({
                  pageIndex: filters.page,
                  pageSize: filters.limit,
                })
              }
              disabled={filters.page >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

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
