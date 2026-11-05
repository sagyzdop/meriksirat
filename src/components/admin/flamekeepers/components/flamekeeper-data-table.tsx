// PROTOTYPE: shared flamekeeper table used by all three page variants. The
// table mirrors the Members data table (selection, status filter, sorting and
// pagination) but sorts and pages client-side because the list query still
// returns every flamekeeper in one call.
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
import { Shield, X } from 'lucide-react'
import { toast } from 'sonner'

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
import { BulkEditClearanceDialog } from '@/components/shared/bulk-edit-clearance-dialog'
import { DataTableFacetedFilter } from '@/components/shared/data-table-faceted-filter'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { ServerDataTablePagination } from '@/components/shared/data-table/server-data-table-pagination'
import { useServerTableSorting } from '@/components/shared/data-table/use-server-table-sorting'
import {
  BanUserDialog,
  UnbanUserDialog,
} from '@/components/shared/ban-user-dialogs'
import { bulkUpdateUserClearanceFn } from '@/lib/user/admin-functions'
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

interface FlamekeeperDataTableProps {
  rows: AdminFlamekeeperRow[]
  filters: FlamekeeperTableFilters
  isLoading?: boolean
  canBan?: boolean
  viewerId?: string
}

export function FlamekeeperDataTable({
  rows,
  filters,
  isLoading = false,
  canBan = false,
  viewerId,
}: FlamekeeperDataTableProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [rowSelection, setRowSelection] = React.useState({})
  const [bulkEditClearanceOpen, setBulkEditClearanceOpen] =
    React.useState(false)
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
      rowSelection,
      pagination: {
        pageIndex: filters.page - 1,
        pageSize: filters.limit,
      },
    },
    getRowId: (row) => row.userId,
    enableRowSelection: true,
    enableSortingRemoval: false,
    onRowSelectionChange: setRowSelection,
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

  const selectedUserIds = Object.keys(rowSelection)
  const banRow = rows.find((row) => row.userId === banUserId)
  const unbanRow = rows.find((row) => row.userId === unbanUserId)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1">
          <Input
            placeholder="Search flamekeepers by name or email..."
            value={filters.search || ''}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="h-8 w-full sm:w-[200px] lg:w-[300px]"
          />
          <div className="flex flex-wrap gap-2">
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

      <div className="relative rounded-md border overflow-x-auto">
        {isLoading && <LoadingOverlay />}
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
            {table.getRowModel().rows.length ? (
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
                      to: '/admin/flamekeepers/$userId',
                      params: { userId: row.original.userId },
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
        selectedCount={selectedUserIds.length}
        totalCount={filteredRows.length}
        onPageChange={(page) => table.setPageIndex(page - 1)}
        onPageSizeChange={(limit) => table.setPageSize(limit)}
      />

      <BulkEditClearanceDialog
        open={bulkEditClearanceOpen}
        onOpenChange={setBulkEditClearanceOpen}
        count={selectedUserIds.length}
        itemNoun="flamekeeper(s)"
        actionPhrase="update the clearance level"
        successMessage={`Updated clearance level for ${selectedUserIds.length} flamekeeper(s)`}
        errorTitle="Failed to update flamekeepers"
        onSubmit={async (clearanceLevel) => {
          await bulkUpdateUserClearanceFn({
            data: { userIds: selectedUserIds, clearanceLevel },
          })
        }}
        onSuccess={() => {
          table.resetRowSelection()
          queryClient.invalidateQueries({ queryKey: ['flamekeepers'] })
          queryClient.invalidateQueries({ queryKey: ['users'] })
        }}
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
