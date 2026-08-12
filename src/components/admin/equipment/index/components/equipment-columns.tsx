import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowUpDown } from 'lucide-react'
import { EquipmentWithCategory } from '@/lib/equipment'

const statusConfig = {
  true: {
    label: 'Active',
    className: 'bg-green-500 text-white hover:bg-green-600',
  },
  false: {
    label: 'Inactive',
    className:
      'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200',
  },
}

export const createEquipmentColumns =
  (): ColumnDef<EquipmentWithCategory>[] => [
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
        const imagePath = row.original.imagePath

        return (
          <img
            src={
              imagePath
                ? `/api/images/${imagePath}`
                : '/equipment-placeholder.svg'
            }
            alt={row.original.modelName}
            className="h-10 w-14 rounded-md border object-cover"
          />
        )
      },
    },
    {
      id: 'modelName',
      accessorFn: (row) => row.modelName,
      header: ({ column }) => (
        <Button variant="ghost" onClick={column.getToggleSortingHandler()}>
          Model Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
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
        <Button variant="ghost" onClick={column.getToggleSortingHandler()}>
          Category
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const category = row.original.category

        return (
          <Badge variant="outline">{category?.name || 'Uncategorized'}</Badge>
        )
      },
      filterFn: (row, _id, value) => {
        const categoryId = row.original.categoryId
        return value.includes(categoryId?.toString() || 'null')
      },
    },
    {
      id: 'requiredClearanceLevel',
      accessorFn: (row) => row.requiredClearanceLevel,
      header: ({ column }) => (
        <Button variant="ghost" onClick={column.getToggleSortingHandler()}>
          Clearance Level
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const clearanceLevel = row.getValue('requiredClearanceLevel') as
          number | null
        if (!clearanceLevel) {
          return <Badge variant="outline">No Level</Badge>
        }
        return (
          <Badge variant="outline" className="font-mono">
            Level {clearanceLevel}
          </Badge>
        )
      },
    },
    {
      id: 'isActive',
      accessorFn: (row) => row.isActive,
      header: ({ column }) => (
        <Button variant="ghost" onClick={column.getToggleSortingHandler()}>
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const isActive = row.getValue('isActive') as boolean | null
        const status = isActive === null ? true : isActive // Default to active if null
        const config =
          statusConfig[status.toString() as keyof typeof statusConfig]

        return (
          <Badge variant="default" className={config.className}>
            {config.label}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        const isActive = row.getValue(id) as boolean | null
        const status = isActive === null ? 'true' : isActive.toString()
        return value.includes(status)
      },
    },
  ]
