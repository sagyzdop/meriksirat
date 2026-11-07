import { Link } from '@tanstack/react-router'
import { MoreHorizontal } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header'
import { AlbumStatusBadge } from '@/components/albums/album-status-badge'
import { AlbumStorageBadge } from '@/components/albums/album-storage-badge'
import { Badge } from '@/components/ui/badge'
import { formatBytes, formatUtcDate } from '@/lib/format'
import type { AdminAlbumRow } from '@/lib/albums/types'
import { OFFLOAD_ENABLED } from './album-table-types'
import type { OnBulkAction } from './album-table-types'

interface AlbumColumnsOptions {
  onBulkAction?: OnBulkAction
}

export function AlbumStorageCell({ album }: { album: AdminAlbumRow }) {
  if (album.storage.holder === 'none') {
    return <Badge variant="outline">Unknown</Badge>
  }
  return <AlbumStorageBadge storage={album.storage} />
}

export const createAlbumColumns = ({
  onBulkAction,
}: AlbumColumnsOptions = {}): ColumnDef<AdminAlbumRow>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <Link
        to="/admin/albums/$albumId"
        params={{ albumId: row.original.id }}
        className="block max-w-[240px] truncate font-medium hover:underline"
        title={row.original.title}
      >
        {row.original.title}
      </Link>
    ),
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: () => <span>Description</span>,
    cell: ({ row }) => (
      <span
        className="block max-w-[240px] truncate text-muted-foreground"
        title={row.original.description}
      >
        {row.original.description || '—'}
      </span>
    ),
    enableSorting: false,
  },
  {
    id: 'event',
    accessorKey: 'event',
    header: () => <span>Event</span>,
    cell: ({ row }) => (
      <span className="block max-w-[180px] truncate">
        {row.original.event || '—'}
      </span>
    ),
    enableSorting: false,
  },
  {
    id: 'eventDate',
    accessorKey: 'eventDate',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Event date" />
    ),
    cell: ({ row }) => formatUtcDate(row.original.eventDate),
  },
  {
    id: 'owner',
    header: () => <span>Owner</span>,
    cell: ({ row }) => (
      <span title={row.original.ownerEmail ?? undefined}>
        {row.original.ownerName ?? 'Unknown'}
      </span>
    ),
    enableSorting: false,
  },
  {
    id: 'photoCount',
    accessorKey: 'photoCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Photos" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.photoCount}</span>
    ),
  },
  {
    id: 'photoBytes',
    accessorKey: 'photoBytes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Size" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatBytes(row.original.photoBytes)}
      </span>
    ),
  },
  {
    id: 'status',
    header: () => <span>Status</span>,
    cell: ({ row }) => (
      <AlbumStatusBadge
        rescuedAt={row.original.rescuedAt}
        scheduledDeletionAt={row.original.scheduledDeletionAt}
      />
    ),
    enableSorting: false,
  },
  {
    id: 'storage',
    header: () => <span>Storage</span>,
    cell: ({ row }) => <AlbumStorageCell album={row.original} />,
    enableSorting: false,
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatUtcDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const album = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Album actions"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/admin/albums/$albumId" params={{ albumId: album.id }}>
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onBulkAction?.('move-to-buffer', [album])}
            >
              Move to Buffer
            </DropdownMenuItem>
            {OFFLOAD_ENABLED && (
              <DropdownMenuItem
                onSelect={() => onBulkAction?.('move-to-flamekeeper', [album])}
              >
                Move to Flamekeepers
              </DropdownMenuItem>
            )}
            {album.scheduledDeletionAt ? (
              <DropdownMenuItem
                onSelect={() => onBulkAction?.('cancel-deletion', [album])}
              >
                Cancel deletion
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onBulkAction?.('schedule-deletion', [album])}
              >
                Schedule for deletion
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
]
