import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'

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
import { ServerDataTablePagination } from '@/components/shared/data-table/server-data-table-pagination'
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header'
import { useScopedServerTableSorting } from '@/components/shared/data-table/use-scoped-server-table-sorting'
import type { DashboardSearchParams } from '@/lib/admin/dashboard-queries'
import type {
  MostActiveUser,
  MostActiveUsersFilters,
} from '@/lib/admin/dashboard-types'

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

interface MostActiveUsersTableProps {
  users: MostActiveUser[]
  pagination: Pagination
  filters: MostActiveUsersFilters
  search: DashboardSearchParams
  isLoading?: boolean
}

export function MostActiveUsersTable({
  users,
  pagination,
  filters,
  search,
  isLoading = false,
}: MostActiveUsersTableProps) {
  const navigate = useNavigate()
  const { sorting, handleSortingChange } = useScopedServerTableSorting(search, {
    prefix: 'active',
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  })

  const columns = React.useMemo<ColumnDef<MostActiveUser>[]>(
    () => [
      {
        accessorKey: 'firstName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="User" />
        ),
        cell: ({ row }) => {
          const user = row.original
          const name = [user.firstName, user.lastName]
            .filter(Boolean)
            .join(' ')
            .trim()
          return <span className="font-medium">{name || 'Unknown user'}</span>
        },
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: 'albumCount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Albums" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {row.original.albumCount}
          </span>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: users,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.limit,
      },
    },
    pageCount: pagination.totalPages,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleSearchChange = React.useCallback(
    (value: string) => {
      navigate({
        to: '.',
        search: {
          ...search,
          activeSearch: value || undefined,
          activePage: 1,
        } as never,
      })
    },
    [search, navigate]
  )

  const handlePageChange = React.useCallback(
    (page: number) => {
      navigate({
        to: '.',
        search: { ...search, activePage: page } as never,
      })
    },
    [search, navigate]
  )

  const handlePageSizeChange = React.useCallback(
    (limit: number) => {
      navigate({
        to: '.',
        search: { ...search, activeLimit: limit, activePage: 1 } as never,
      })
    },
    [search, navigate]
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search users by name or email..."
        value={filters.search || ''}
        onChange={(event) => handleSearchChange(event.target.value)}
        className="h-8 w-full sm:w-[280px]"
      />
      <div className="relative rounded-md border overflow-x-auto">
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({
                      to: '/admin/users/$userId',
                      params: { userId: row.original.id },
                    })
                  }
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
        pageSizeOptions={[5, 10, 20, 30, 40, 50]}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
