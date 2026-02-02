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
import { format } from "date-fns"
import { Link } from "@tanstack/react-router"
import { EquipmentWithCategory } from "@/lib/equipment"

const statusConfig = {
  true: { label: "Active", variant: "default" as const },
  false: { label: "Inactive", variant: "secondary" as const },
}

export const equipmentColumns: ColumnDef<EquipmentWithCategory>[] = [
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
    id: "modelName",
    accessorFn: (row) => row.modelName,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
    accessorKey: "category",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
    sortingFn: (rowA, rowB) => {
      const categoryA = rowA.original.category?.name || "Uncategorized"
      const categoryB = rowB.original.category?.name || "Uncategorized"
      return categoryA.localeCompare(categoryB)
    },
    filterFn: (row, id, value) => {
      const categoryId = row.original.categoryId
      return value.includes(categoryId?.toString() || "null")
    },
  },
  {
    accessorKey: "requiredClearanceLevel",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
    accessorKey: "isActive",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Created
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const createdAt = row.getValue("createdAt") as Date | null
      if (!createdAt) return <span className="text-muted-foreground">No date</span>
      
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {format(new Date(createdAt), "MMM dd, yyyy")}
          </span>
          <span className="text-sm text-muted-foreground">
            {format(new Date(createdAt), "HH:mm")}
          </span>
        </div>
      )
    },
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
                to="/admin/equipment/$/edit" 
                params={{ _splat: equipment.id.toString() }}
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
              onClick={() => {
                // TODO: Implement delete functionality
                console.log("Delete equipment:", equipment.id)
              }}
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