import { ColumnDef } from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'

import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header'
import type { BirthdayUser } from '@/lib/birthdays/types'

function formatOccurrence(occurrence: string): string {
  return new Date(`${occurrence}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export const createBirthdayColumns = (): ColumnDef<BirthdayUser>[] => [
  {
    id: 'firstName',
    accessorFn: (row) =>
      [row.firstName, row.lastName].filter(Boolean).join(' '),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Member" />
    ),
    cell: ({ row }) => {
      const birthday = row.original
      const displayName =
        [birthday.firstName, birthday.lastName].filter(Boolean).join(' ') ||
        'No name'

      return (
        <div className="flex flex-col">
          <Link
            to="/admin/users/$userId"
            params={{ userId: birthday.id }}
            className="font-medium underline-offset-2 hover:underline"
          >
            {displayName}
          </Link>
          {birthday.email && (
            <span className="text-sm text-muted-foreground">
              {birthday.email}
            </span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'occurrence',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Birthday" />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatOccurrence(row.original.occurrence)}
      </span>
    ),
  },
  {
    accessorKey: 'turningAge',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Age" />
    ),
    cell: ({ row }) => {
      const age = row.original.turningAge
      return (
        <span className="whitespace-nowrap">
          {age !== null ? `Turning ${age}` : '—'}
        </span>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.status}</Badge>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
]

export const birthdayColumns = createBirthdayColumns()
