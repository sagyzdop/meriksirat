import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUpDown, MoreHorizontal, Eye, Edit, Trash2, Calendar } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { EquipmentWithCategory } from "@/lib/equipment"

interface EquipmentActionsProps {
  equipment: EquipmentWithCategory
  onEdit: (equipment: EquipmentWithCategory) => void
  onDelete: (equipment: EquipmentWithCategory) => void
}

const statusConfig = {
  true: { label: "Active", variant: "default" as const },
  false: { label: "Inactive", variant: "secondary" as const },
}

export const createEquipmentColumns = (
  onEdit: (equipment: EquipmentWithCategory) => void,
  onDelete: (equipment: EquipmentWithCategory) => void
): ColumnDef<EquipmentWithCategory>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
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
    id: "modelName",
    accessorFn: (row) => row.modelName,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={column.getToggleSortingHandler()}
      >
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
            <span className="text-sm text-muted-foreground line-clamp-1">
              {equipment.description}
            </span>
          )}
        </div>
      )
    },
  },
  {
    id: "category",
    accessorFn: (row) => row.category?.name || "Uncategorized",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={column.getToggleSortingHandler()}
      >
        Category
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const category = row.original.category
      
      return (
        <Badge variant="outline">
          {category?.name || "Uncategorized"}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      const categoryId = row.original.categoryId
      return value.includes(categoryId?.toString() || "null")
    },
  },
  {
    id: "requiredClearanceLevel",
    accessorFn: (row) => row.requiredClearanceLevel,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={column.getToggleSortingHandler()}
      >
        Clearance Level
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const clearanceLevel = row.getValue("requiredClearanceLevel") as number | null
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
    id: "isActive",
    accessorFn: (row) => row.isActive,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={column.getToggleSortingHandler()}
      >
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const isActive = row.getValue("isActive") as boolean | null
      const status = isActive === null ? true : isActive // Default to active if null
      const config = statusConfig[status.toString() as keyof typeof statusConfig]
      
      return (
        <Badge variant={config.variant}>
          {config.label}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      const isActive = row.getValue(id) as boolean | null
      const status = isActive === null ? "true" : isActive.toString()
      return value.includes(status)
    },
  },
  {
    id: "availability",
    header: "Availability",
    cell: ({ row }) => {
      const isActive = row.getValue("isActive") as boolean | null
      const status = isActive === null ? true : isActive
      
      // For now, show availability based on active status
      // In a real implementation, this would check current bookings
      if (!status) {
        return (
          <Badge variant="secondary">
            Unavailable
          </Badge>
        )
      }
      
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          Available
        </Badge>
      )
    },
  },
  {
    id: "edit",
    header: "",
    enableHiding: false,
    cell: ({ row }) => {
      const equipment = row.original

      return (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button asChild size="sm" variant="outline">
            <Link 
              to="/admin/equipment/$equipmentId/edit" 
              params={{ equipmentId: equipment.id.toString() }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      )
    },
    size: 100,
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const equipment = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(equipment.id.toString())}
            >
              Copy equipment ID
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(equipment.googleCalendarId)}
            >
              Copy calendar ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link 
                to="/admin/equipment/$equipmentId/edit" 
                params={{ equipmentId: equipment.id.toString() }}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit equipment
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link 
                to="/equipment/$" 
                params={{ _splat: equipment.id.toString() }}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link 
                to="/bookings" 
                search={{ equipmentId: equipment.id }}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                View bookings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(equipment)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete equipment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]