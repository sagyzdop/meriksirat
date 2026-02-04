import * as React from "react"
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
import { ArrowUpDown, MoreHorizontal, Edit, Calendar, AlertCircle, Trash } from "lucide-react"
import { format, isPast } from "date-fns"
import { Link, useRouter } from "@tanstack/react-router"
import type { AdminBookingWithDetails } from "@/lib/booking/types"
import { cn } from "@/lib/utils"
import { DeleteBookingDialog } from "./delete-booking-dialog"

const statusConfig = {
  booked: { label: "Booked", variant: "default" as const },
  active: { label: "Active", variant: "default" as const },
  returned: { label: "Returned", variant: "secondary" as const },
  cancelled: { label: "Cancelled", variant: "outline" as const },
  overdue: { label: "Overdue", variant: "destructive" as const },
}

export const bookingColumns: ColumnDef<AdminBookingWithDetails>[] = [
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
    accessorKey: "user",
    header: "User",
    cell: ({ row }) => {
      const booking = row.original
      const user = booking.user

      if (!user) {
        return <span className="text-muted-foreground">Unknown User</span>
      }

      const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name'

      return (
        <div className="flex flex-col max-w-[200px]">
          <span className="font-medium truncate">{displayName}</span>
          <span className="text-sm text-muted-foreground font-mono truncate">
            {user.email}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "equipment",
    header: "Equipment",
    cell: ({ row }) => {
      const booking = row.original
      const equipment = booking.equipment

      if (!equipment) {
        return <span className="text-muted-foreground">Unknown Equipment</span>
      }

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
    id: "startTime",
    accessorFn: (row) => row.startTime,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={column.getToggleSortingHandler()}
      >
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
    id: "endTime",
    accessorFn: (row) => row.endTime,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={column.getToggleSortingHandler()}
      >
        End Time
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const booking = row.original
      const endTime = row.getValue("endTime") as Date
      if (!endTime) return <span className="text-muted-foreground">No date</span>

      const isOverdue = isPast(new Date(endTime)) &&
        (booking.status === 'booked' || booking.status === 'active')

      return (
        <div className="flex flex-col">
          <span className={cn(
            "font-medium",
            isOverdue && "text-destructive"
          )}>
            {format(new Date(endTime), "MMM dd, yyyy")}
          </span>
          <span className={cn(
            "text-sm flex items-center gap-1",
            isOverdue ? "text-destructive" : "text-muted-foreground"
          )}>
            {isOverdue && <AlertCircle className="h-3 w-3" />}
            {format(new Date(endTime), "HH:mm")}
          </span>
        </div>
      )
    },
  },
  {
    id: "status",
    accessorFn: (row) => row.status,
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
      const booking = row.original
      const status = row.getValue("status") as keyof typeof statusConfig

      // Check if booking is actually overdue (past end time and not returned/cancelled)
      const isOverdue = isPast(new Date(booking.endTime)) &&
        (status === 'booked' || status === 'active')

      const displayStatus = isOverdue ? 'overdue' : status
      const config = statusConfig[displayStatus] || statusConfig.booked

      return (
        <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
          {isOverdue && <AlertCircle className="h-3 w-3" />}
          {config.label}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: "createdAt",
    accessorFn: (row) => row.createdAt,
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
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const booking = row.original
      const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
      const router = useRouter()


      return (
        <>
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
                onClick={() => navigator.clipboard.writeText(booking.id.toString())}
              >
                Copy booking ID
              </DropdownMenuItem>
              {booking.googleCalendarEventId && (
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(booking.googleCalendarEventId || '')}
                >
                  Copy calendar event ID
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  to="/admin/bookings/$bookingId/edit"
                  params={{ bookingId: booking.id.toString() }}
                  className="flex items-center"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit booking
                </Link>
              </DropdownMenuItem>

              {booking.equipment?.id && (
                <DropdownMenuItem asChild>
                  <Link
                    to="/equipment/$"
                    params={{ _splat: booking.equipment.id.toString() }}
                    className="flex items-center"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    View equipment
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete booking
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DeleteBookingDialog
            booking={booking}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onSuccess={() => {
              router.invalidate()
            }}

          />
        </>
      )
    },
  },
]
