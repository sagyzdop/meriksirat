import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link, useNavigate } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { UserTabs } from '@/components/admin/users/components/user-tabs'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header'
import { ServerDataTablePagination } from '@/components/shared/data-table/server-data-table-pagination'
import { useServerTableSorting } from '@/components/shared/data-table/use-server-table-sorting'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminAlumniFilters, AlumniRow } from '@/lib/user/types'

interface PageProps {
  users: AlumniRow[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
  filters: AdminAlumniFilters
  isLoading?: boolean
}

const columns: ColumnDef<AlumniRow>[] = [
  {
    id: 'firstName',
    accessorFn: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const u = row.original
      const name =
        `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'No name'
      return (
        <div className="flex items-center gap-3">
          <UserAvatar image={u.image} name={name} className="size-8" />
          <Link
            to="/admin/users/$userId"
            params={{ userId: u.id }}
            className="font-medium hover:underline"
          >
            {name}
          </Link>
        </div>
      )
    },
  },
  {
    id: 'email',
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
  },
  {
    id: 'isMember',
    accessorKey: 'isMember',
    enableSorting: false,
    header: 'Member',
    cell: ({ row }) =>
      row.original.isMember ? (
        <Badge variant="secondary">Member</Badge>
      ) : (
        <span className="text-muted-foreground">No</span>
      ),
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Joined" />
    ),
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
]

export function Page({
  users,
  pagination,
  filters,
  isLoading = false,
}: PageProps) {
  const navigate = useNavigate()
  const { sorting, handleSortingChange } = useServerTableSorting(filters)

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

  const description =
    pagination.totalCount > 0
      ? `${pagination.totalCount} alumni account${pagination.totalCount === 1 ? '' : 's'}`
      : 'No alumni found'

  return (
    <PageContainer>
      <PageHeader title="Manage Users" description={description} />
      <UserTabs active="alumni" />
      <div className="space-y-4">
        <Input
          placeholder="Search alumni by name or email..."
          value={filters.search || ''}
          onChange={(e) =>
            navigate({
              to: '.',
              search: {
                ...filters,
                search: e.target.value || undefined,
                page: 1,
              },
            })
          }
          className="h-8 w-full sm:w-[300px]"
        />
        <div className="relative rounded-md border overflow-x-auto">
          {isLoading && <LoadingOverlay />}
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
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
                  <TableRow key={row.id}>
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
          selectedCount={0}
          totalCount={pagination.totalCount}
          onPageChange={(page) =>
            navigate({ to: '.', search: { ...filters, page } })
          }
          onPageSizeChange={(limit) =>
            navigate({ to: '.', search: { ...filters, limit, page: 1 } })
          }
        />
      </div>
    </PageContainer>
  )
}
