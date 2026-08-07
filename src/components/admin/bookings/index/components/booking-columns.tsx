import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
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
import { format } from "date-fns"
import { Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import type { AdminBookingWithDetails } from "@/lib/booking/types"
import { cn } from "@/lib/utils"
import { DeleteBookingDialog } from "./delete-booking-dialog"
import { BookingStatusBadge, isBookingOverdue } from "@/components/shared/booking-status-badge"

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
      const items = booking.items ?? []
      const firstEquipment = items[0]?.equipment

      if (!firstEquipment) {
        return <span className="text-muted-foreground">Unknown Equipment</span>
      }

      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {items.map((item) => item.equipment?.modelName).filter(Boolean).join(", ")}
          </span>
          {items.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {items.length} items
            </span>
          )}
          {firstEquipment.description && (
            <span className="text-sm text-muted-foreground line-clamp-1">
              {firstEquipment.description}
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

      const isOverdue = isBookingOverdue(endTime, booking.status)

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
      const status = row.getValue("status") as string

      return (
        <BookingStatusBadge
          status={status}
          endTime={booking.endTime}
          showOverdueIcon
          className="flex items-center gap-1"
        />
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
      const queryClient = useQueryClient()


      return (
        <div onClick={(event) => event.stopPropagation()}>
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
              {booking.items?.some((item) => item.googleCalendarEventId) && (
                <DropdownMenuItem
                  onClick={() => {
                    const eventId = booking.items?.find((item) => item.googleCalendarEventId)?.googleCalendarEventId || ''
                    navigator.clipboard.writeText(eventId)
                  }}
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

              {booking.items?.[0]?.equipment && (
                <DropdownMenuItem asChild>
                  <Link
                    to="/equipment/$"
                    params={{ _splat: booking.items[0].equipment.id.toString() }}
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
              queryClient.invalidateQueries({ queryKey: ['bookings'] })
            }}

          />
        </div>
      )
    },
  },
]
