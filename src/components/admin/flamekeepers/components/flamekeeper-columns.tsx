import type { ColumnDef } from '@tanstack/react-table'
import { ShieldBan, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header'
import { UserAvatar } from '@/components/shared/user-avatar'
import { formatGb } from '@/lib/flamekeeper/rules'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { formatGraduationMonth } from '@/lib/graduation-date'
import { flamekeeperStatus, StatusBadge } from './state-badge'

interface CreateFlamekeeperColumnsOptions {
  onBan?: (row: AdminFlamekeeperRow) => void
  onUnban?: (row: AdminFlamekeeperRow) => void
  canBan?: boolean
  viewerId?: string
}

export const createFlamekeeperColumns = ({
  onBan,
  onUnban,
  canBan = false,
  viewerId,
}: CreateFlamekeeperColumnsOptions = {}): ColumnDef<AdminFlamekeeperRow>[] => [
  {
    id: 'name',
    accessorFn: (row) => row.name,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const fk = row.original

      return (
        <div className="flex items-center gap-3">
          <UserAvatar image={fk.image} name={fk.name} className="size-8" />
          <div className="flex flex-col">
            <span className="flex items-center gap-2 font-medium">
              {fk.name || 'No name'}
              {fk.isMember && <Badge variant="secondary">Member</Badge>}
            </span>
            <span className="text-sm text-muted-foreground">{fk.email}</span>
          </div>
        </div>
      )
    },
  },
  {
    id: 'status',
    accessorFn: (row) => flamekeeperStatus(row),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <StatusBadge row={row.original} />,
  },
  {
    accessorKey: 'pledgedBytes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pledged" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatGb(row.original.pledgedBytes)}
      </span>
    ),
  },
  {
    accessorKey: 'usedBytes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Used" />
    ),
    cell: ({ row }) => {
      const { usedBytes, pledgedBytes } = row.original
      const percent =
        pledgedBytes > 0 ? Math.round((100 * usedBytes) / pledgedBytes) : 0

      return (
        <span className="tabular-nums">
          {formatGb(usedBytes)}
          <span className="ml-2 text-xs text-muted-foreground">{percent}%</span>
        </span>
      )
    },
  },
  {
    accessorKey: 'graduationDate',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Graduation" />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatGraduationMonth(row.original.graduationDate) || '—'}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => {
      const fk = row.original
      if (!canBan || fk.userId === viewerId) return null

      return (
        <div className="text-right">
          {fk.bannedAt ? (
            <Button size="sm" variant="outline" onClick={() => onUnban?.(fk)}>
              <ShieldCheck data-icon="inline-start" />
              Unban
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onBan?.(fk)}>
              <ShieldBan data-icon="inline-start" />
              Ban
            </Button>
          )}
        </div>
      )
    },
  },
]
