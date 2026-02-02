/**
 * Booking History Columns for Profile Page
 * 
 * Simplified column definitions for displaying user's booking history in their profile.
 * Shows essential booking information without edit/cancel actions.
 */
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Calendar, Clock } from "lucide-react"
import { BookingWithEquipment } from "@/lib/booking/types"
import { format } from "date-fns"

const statusConfig = {
  booked: { label: "Booked", variant: "secondary" as const },
  active: { label: "Active", variant: "default" as const },
  returned: { label: "Returned", variant: "secondary" as const },
  cancelled: { label: "Cancelled", variant: "destructive" as const },
  overdue: { label: "Overdue", variant: "destructive" as const },
}

export const bookingHistoryColumns: ColumnDef<BookingWithEquipment>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => {
      const id = row.getValue("id") as number
      return <span className="font-medium">#{id}</span>
    },
  },
  {
    id: "equipment",
    accessorFn: (row) => row.equipment?.modelName,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Equipment
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const equipment = row.original.equipment
      return (
        <div className="flex flex-col">
          <span className="font-medium">{equipment?.modelName}</span>
          {equipment?.description && (
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
              {equipment.description}
            </span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "startTime",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <Calendar className="mr-2 h-4 w-4" />
        Start
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const startTime = row.getValue("startTime") as Date
      if (!startTime) return <span className="text-muted-foreground">No date</span>
      
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {format(new Date(startTime), "MMM dd, yyyy")}
          </span>
          <span className="text-sm text-muted-foreground">
            {format(new Date(startTime), "HH:mm")}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "endTime",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <Clock className="mr-2 h-4 w-4" />
        End
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const endTime = row.getValue("endTime") as Date
      if (!endTime) return <span className="text-muted-foreground">No date</span>
      
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {format(new Date(endTime), "MMM dd, yyyy")}
          </span>
          <span className="text-sm text-muted-foreground">
            {format(new Date(endTime), "HH:mm")}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as keyof typeof statusConfig
      const config = statusConfig[status] || { label: status, variant: "secondary" as const }
      
      return (
        <Badge variant={config.variant}>
          {config.label}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
]
