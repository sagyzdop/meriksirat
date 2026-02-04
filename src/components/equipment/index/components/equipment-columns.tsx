import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUpDown, MoreHorizontal, Calendar, Eye } from "lucide-react"
import { Equipment } from "./types"
import { Link } from "@tanstack/react-router"

export function getEquipmentColumns(): ColumnDef<Equipment>[] {
  return [
    {
      id: "image",
      header: "",
      cell: ({ row }) => {
        const equipment = row.original
        const placeholderImage = "/equipment-placeholder.svg"
        const imageUrl = equipment.imagePath ? `/api/images/${equipment.imagePath}` : placeholderImage
        
        return (
          <div className="flex items-center justify-center min-w-12">
            <img
              src={imageUrl}
              alt={equipment.modelName}
              className="h-12 w-12 rounded-md object-cover shrink-0"
              onError={(e) => {
                e.currentTarget.src = placeholderImage
              }}
            />
          </div>
        )
      },
      enableSorting: false,
      size: 60,
    },
    {
      id: "modelName",
      accessorFn: (row) => row.modelName,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
        >
          Equipment
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
      accessorFn: (row) => row.category?.name,
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
      filterFn: (row, _id, value) => {
        return value.includes(row.original.categoryId?.toString() || "null")
      },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const equipment = row.original
        const isAvailable = equipment.isActive !== false

        return (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button asChild size="sm" disabled={!isAvailable}>
              <Link 
                to="/bookings/new"
                search={{ equipmentId: equipment.id }}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Book
              </Link>
            </Button>
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
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link 
                    to="/equipment/$" 
                    params={{ _splat: equipment.id.toString() }}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      size: 150,
    },
  ]
}
