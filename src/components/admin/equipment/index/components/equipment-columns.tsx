import { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { CalendarDays, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header'
import { InlineSelect } from '@/components/admin/members/index/components/user-columns'
import { EquipmentWithCategory } from '@/lib/equipment'

export function getGoogleCalendarEmbedUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/u/2/newembed?src=${encodeURIComponent(
    calendarId
  )}&ctz=Asia/Almaty&csspa=1`
}

export type EquipmentField =
  'categoryId' | 'requiredClearanceLevel' | 'isActive'

interface EquipmentColumnsOptions {
  categories?: { id: number; name: string }[]
  onUpdateField?: (
    equipmentId: number,
    field: EquipmentField,
    value: string
  ) => Promise<void>
}

function EquipmentImageCell({
  imagePath,
  modelName,
}: {
  imagePath: string | null
  modelName: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const showPlaceholder = imageFailed || !imagePath

  if (showPlaceholder) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted">
        <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
      </div>
    )
  }

  return (
    <img
      src={`/api/images/${imagePath}`}
      alt={modelName}
      onError={() => setImageFailed(true)}
      className="h-10 w-10 rounded-md border object-contain"
    />
  )
}

export const createEquipmentColumns = ({
  categories = [],
  onUpdateField,
}: EquipmentColumnsOptions = {}): ColumnDef<EquipmentWithCategory>[] => [
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
        onClick={(e) => e.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'image',
    accessorFn: (row) => row.imagePath,
    header: 'Image',
    enableSorting: false,
    cell: ({ row }) => {
      const equipment = row.original

      return (
        <EquipmentImageCell
          imagePath={equipment.imagePath}
          modelName={equipment.modelName}
        />
      )
    },
  },
  {
    id: 'modelName',
    accessorFn: (row) => row.modelName,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model Name" />
    ),
    cell: ({ row }) => {
      const equipment = row.original

      return (
        <div className="flex flex-col">
          <span className="font-medium">{equipment.modelName}</span>
          {equipment.description && (
            <span className="max-w-[280px] truncate text-sm text-muted-foreground">
              {equipment.description}
            </span>
          )}
        </div>
      )
    },
  },
  {
    id: 'category',
    accessorFn: (row) => row.category?.name || 'Uncategorized',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ row }) => (
      <InlineSelect
        value={row.original.categoryId?.toString() ?? ''}
        placeholder="Uncategorized"
        options={categories.map((c) => ({
          value: c.id.toString(),
          label: c.name,
        }))}
        onValueChange={(value) =>
          onUpdateField?.(row.original.id, 'categoryId', value)
        }
      />
    ),
    filterFn: (row, _id, value) => {
      const categoryId = row.original.categoryId
      return value.includes(categoryId?.toString() || 'null')
    },
  },
  {
    id: 'requiredClearanceLevel',
    accessorFn: (row) => row.requiredClearanceLevel,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Clearance Level" />
    ),
    cell: ({ row }) => (
      <InlineSelect
        value={row.original.requiredClearanceLevel?.toString() ?? ''}
        placeholder="—"
        options={[...Array(10)].map((_, i) => ({
          value: (i + 1).toString(),
          label: `Level ${i + 1}`,
        }))}
        onValueChange={(value) =>
          onUpdateField?.(row.original.id, 'requiredClearanceLevel', value)
        }
      />
    ),
  },
  {
    id: 'isActive',
    accessorFn: (row) => row.isActive,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <InlineSelect
        value={(row.original.isActive ?? true).toString()}
        options={[
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' },
        ]}
        onValueChange={(value) =>
          onUpdateField?.(row.original.id, 'isActive', value)
        }
      />
    ),
    filterFn: (row, id, value) => {
      const isActive = row.getValue(id) as boolean | null
      const status = isActive === null ? 'true' : isActive.toString()
      return value.includes(status)
    },
  },
  {
    id: 'calendar',
    accessorFn: (row) => row.googleCalendarId,
    header: 'Calendar',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const googleCalendarId = row.original.googleCalendarId

      return (
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a
            href={getGoogleCalendarEmbedUrl(googleCalendarId)}
            target="_blank"
            rel="noopener noreferrer"
            title="View in Google Calendar"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            View
          </a>
        </Button>
      )
    },
  },
]
