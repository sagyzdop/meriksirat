import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { DataTableFacetedFilter } from '@/components/shared/data-table-faceted-filter'
import { useScopedServerTableSorting } from '@/components/shared/data-table/use-scoped-server-table-sorting'
import type { DashboardSearchParams } from '@/lib/admin/dashboard-queries'
import type {
  ViolationRow,
  ViolationsFilters,
} from '@/lib/admin/dashboard-types'

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

interface ViolationsTableProps {
  users: ViolationRow[]
  pagination: Pagination
  filters: ViolationsFilters
  search: DashboardSearchParams
  isLoading?: boolean
}

const violationTypeOptions = [
  { value: 'auto-cancelled', label: 'Auto-cancelled' },
  { value: 'overdue', label: 'Overdue' },
]

const roleStyles: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  manager:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  user: '',
}

export function ViolationsTable({
  users,
  pagination,
  filters,
  search,
  isLoading = false,
}: ViolationsTableProps) {
  const navigate = useNavigate()
  const { sorting, handleSortingChange } = useScopedServerTableSorting(search, {
    prefix: 'violation',
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  })

  const columns = React.useMemo<ColumnDef<ViolationRow>[]>(
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
        accessorKey: 'role',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const role = row.original.role
          if (!role) return <span className="text-muted-foreground">—</span>
          const label = role.charAt(0).toUpperCase() + role.slice(1)
          return (
            <Badge variant="outline" className={roleStyles[role]}>
              {label}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => row.original.status ?? '—',
      },
      {
        accessorKey: 'cancelledInStartWindowCount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Auto-cancelled" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.cancelledInStartWindowCount}
          </span>
        ),
      },
      {
        accessorKey: 'overdueCount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Overdue" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.overdueCount}</span>
        ),
      },
      {
        id: 'violationTypes',
        header: 'Violation Types',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.violationTypes.map((type) => (
              <Badge
                key={type}
                variant="outline"
                className="text-muted-foreground"
              >
                {type === 'auto-cancelled' ? 'Auto-cancelled' : 'Overdue'}
              </Badge>
            ))}
          </div>
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
          violationSearch: value || undefined,
          violationPage: 1,
        } as never,
      })
    },
    [search, navigate]
  )

  const handleTypeFilterChange = React.useCallback(
    (values: string[] | undefined) => {
      navigate({
        to: '.',
        search: {
          ...search,
          violationType: values && values.length > 0 ? values : undefined,
          violationPage: 1,
        } as never,
      })
    },
    [search, navigate]
  )

  const handlePageChange = React.useCallback(
    (page: number) => {
      navigate({
        to: '.',
        search: { ...search, violationPage: page } as never,
      })
    },
    [search, navigate]
  )

  const handlePageSizeChange = React.useCallback(
    (limit: number) => {
      navigate({
        to: '.',
        search: { ...search, violationLimit: limit, violationPage: 1 } as never,
      })
    },
    [search, navigate]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          placeholder="Search users by name or email..."
          value={filters.search || ''}
          onChange={(event) => handleSearchChange(event.target.value)}
          className="h-8 w-full sm:w-[280px]"
        />
        <DataTableFacetedFilter
          title="Type"
          options={violationTypeOptions}
          selectedValues={filters.violationType ?? []}
          onSelectionChange={handleTypeFilterChange}
        />
      </div>
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
