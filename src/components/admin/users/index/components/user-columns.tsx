import { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header'
import { User } from '@/lib/user/types'

export type UserField = 'role' | 'clearanceLevel' | 'status'

interface UserColumnsOptions {
  onUpdateField?: (
    userId: string,
    field: UserField,
    value: string
  ) => Promise<void>
  canAssignElevatedRoles?: boolean
}

interface InlineSelectProps {
  value: string
  placeholder?: string
  options: { value: string; label: string; disabled?: boolean }[]
  onValueChange: (value: string) => void
}

function InlineSelect({
  value,
  placeholder,
  options,
  onValueChange,
}: InlineSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className="h-8 w-32">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export const createUserColumns = ({
  onUpdateField,
  canAssignElevatedRoles = true,
}: UserColumnsOptions = {}): ColumnDef<User>[] => [
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
    id: 'firstName', // Use id instead of accessorKey to match backend sortBy
    accessorFn: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const user = row.original
      const displayName =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name'

      return (
        <div className="flex flex-col">
          <span className="font-medium">{displayName}</span>
          {user.email && (
            <span className="text-sm text-muted-foreground">{user.email}</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => {
      const user = row.original
      const role = user.role ?? ''

      return (
        <InlineSelect
          value={role}
          placeholder="—"
          options={[
            { value: 'user', label: 'User' },
            {
              value: 'manager',
              label: 'Manager',
              disabled: !canAssignElevatedRoles,
            },
            {
              value: 'admin',
              label: 'Admin',
              disabled: !canAssignElevatedRoles,
            },
          ]}
          onValueChange={(value) => onUpdateField?.(user.id, 'role', value)}
        />
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'clearanceLevel',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Clearance" />
    ),
    cell: ({ row }) => {
      const user = row.original
      const clearanceLevel = user.clearanceLevel ?? null

      return (
        <InlineSelect
          value={clearanceLevel ? clearanceLevel.toString() : ''}
          placeholder="—"
          options={[...Array(10)].map((_, i) => ({
            value: (i + 1).toString(),
            label: `Level ${i + 1}`,
          }))}
          onValueChange={(value) =>
            onUpdateField?.(user.id, 'clearanceLevel', value)
          }
        />
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const user = row.original
      const status = user.status ?? ''

      return (
        <InlineSelect
          value={status}
          placeholder="—"
          options={[
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
            { value: 'On Probation', label: 'On Probation' },
            { value: 'Board', label: 'Board' },
            { value: 'Ex-Board', label: 'Ex-Board' },
            { value: 'Roommate', label: 'Roommate' },
            { value: 'Ex-Roommate', label: 'Ex-Roommate' },
            { value: 'Graduated', label: 'Graduated' },
          ]}
          onValueChange={(value) => onUpdateField?.(user.id, 'status', value)}
        />
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
]

// Export a default version for backward compatibility
export const userColumns = createUserColumns()
