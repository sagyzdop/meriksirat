
import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUpDown, Calendar, Clock, Pencil } from "lucide-react"
import { BookingWithItems } from "@/lib/booking/types"
import { format } from "date-fns"
import { Link } from "@tanstack/react-router"
import { CancelBookingDialog } from "./cancel-booking-dialog"

const statusConfig = {
  booked: { label: "Booked", variant: "secondary" as const },
  active: { label: "Active", variant: "default" as const },
  returned: { label: "Returned", variant: "secondary" as const },
  cancelled: { label: "Cancelled", variant: "destructive" as const },
  overdue: { label: "Overdue", variant: "destructive" as const },
  partially_returned: { label: "Partially Returned", variant: "default" as const },
}

export function getBookingColumns(): ColumnDef<BookingWithItems>[] {
  return [
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
      <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => {
      const id = row.getValue("id") as number
      
      return (
        <span className="font-medium">
          #{id}
        </span>
      )
    },
  },
  {
    id: "equipment",
    accessorFn: (row) => row.items[0]?.equipment?.modelName,
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
      const items = row.original.items
      return (
        <div className="flex flex-col gap-0.5">
          {items.length === 0 && <span className="text-muted-foreground">—</span>}
          {items.map((item) => (
            <span key={item.id} className="font-medium line-clamp-1">
              {item.equipment?.modelName ?? `Equipment ${item.equipmentId}`}
            </span>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: "startTime",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={column.getToggleSortingHandler()}
      >
        <Calendar className="mr-2 h-4 w-4" />
        Start Time
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
        onClick={column.getToggleSortingHandler()}
      >
        <Clock className="mr-2 h-4 w-4" />
        End Time
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
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={column.getToggleSortingHandler()}
      >
        Created
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const createdAt = row.getValue("createdAt") as Date
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
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.booked
      
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
  {
    id: "actions",
    header: "",
    enableHiding: false,
    cell: ({ row }) => {
      const booking = row.original
      const [showCancelDialog, setShowCancelDialog] = React.useState(false)
      const canCancel = booking.status === "booked" || booking.status === "active"

      return (
        <>
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button 
              size="sm" 
              variant="outline"
              asChild
            >
              <Link 
                to="/bookings/$bookingId/edit" 
                params={{ bookingId: booking.id.toString() }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            {canCancel && (
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel
              </Button>
            )}
          </div>

          <CancelBookingDialog
            booking={booking}
            open={showCancelDialog}
            onOpenChange={setShowCancelDialog}
          />
        </>
      )
    },
    size: 180,
  },
]
}