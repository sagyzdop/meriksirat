import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Images } from 'lucide-react'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { ServerDataTablePagination } from '@/components/shared/data-table/server-data-table-pagination'
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header'
import { useScopedServerTableSorting } from '@/components/shared/data-table/use-scoped-server-table-sorting'
import { PhotoImage } from '@/components/albums/photo-image'
import type { AdminUserAlbum } from '@/lib/admin/dashboard-types'
import type { PaginationMeta } from '@/lib/pagination'

export interface AlbumSearch {
  albumSearch?: string
  albumPage: number
  albumLimit: number
  albumSortBy: 'title' | 'createdAt' | 'coAuthorCount'
  albumSortOrder: 'asc' | 'desc'
}

interface UserAlbumsTableProps {
  albums: AdminUserAlbum[]
  pagination: PaginationMeta
  filters: {
    page: number
    limit: number
    sortBy: 'title' | 'createdAt' | 'coAuthorCount'
    sortOrder: 'asc' | 'desc'
  }
  search: AlbumSearch
  isLoading?: boolean
}

const formatCreatedAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function UserAlbumsTable({
  albums,
  pagination,
  filters,
  search,
  isLoading = false,
}: UserAlbumsTableProps) {
  const navigate = useNavigate()
  const { sorting, handleSortingChange } = useScopedServerTableSorting(search, {
    prefix: 'album',
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  })

  const columns = React.useMemo<ColumnDef<AdminUserAlbum>[]>(
    () => [
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Title" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
              {row.original.coverUrl ? (
                <PhotoImage
                  src={row.original.coverUrl}
                  alt={row.original.title}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Images className="h-4 w-4 text-muted-foreground/50" />
                </div>
              )}
            </div>
            <span className="font-medium">{row.original.title}</span>
          </div>
        ),
      },
      {
        accessorKey: 'coAuthorCount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Co-authors" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.coAuthorCount}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatCreatedAt(row.original.createdAt)}
          </span>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: albums,
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

  const handlePageChange = React.useCallback(
    (page: number) => {
      navigate({
        to: '.',
        search: { ...search, albumPage: page } as never,
      })
    },
    [search, navigate]
  )

  const handlePageSizeChange = React.useCallback(
    (limit: number) => {
      navigate({
        to: '.',
        search: { ...search, albumLimit: limit, albumPage: 1 } as never,
      })
    },
    [search, navigate]
  )

  return (
    <div className="space-y-4">
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
        totalCount={pagination.totalCount}
        pageSizeOptions={[5, 10, 20, 30, 40, 50]}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
