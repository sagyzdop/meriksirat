
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
import { ArrowUpDown, Calendar, Clock, MoreHorizontal, Eye, MessageCircle } from "lucide-react"
import { BookingWithEquipment } from "@/lib/booking-types"
import { format } from "date-fns"
import { Link } from "@tanstack/react-router"
import { createTelegramBotLink, canReturnBooking, getReturnButtonText, TELEGRAM_BOT_CONFIG } from "@/lib/telegram/client-utils"

const statusConfig = {
  booked: { label: "Booked", variant: "secondary" as const },
  active: { label: "Active", variant: "default" as const },
  returned: { label: "Returned", variant: "secondary" as const },
  cancelled: { label: "Cancelled", variant: "destructive" as const },
  overdue: { label: "Overdue", variant: "destructive" as const },
}

export const bookingColumns: ColumnDef<BookingWithEquipment>[] = [
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
    accessorKey: "id",
    header: "Booking ID",
    cell: ({ row }) => (
      <Link 
        to="/bookings/$" 
        params={{ _splat: row.getValue("id").toString() }}
        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
      >
        #{row.getValue("id")}
      </Link>
    ),
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
            <span className="text-sm text-muted-foreground">
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
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as keyof typeof statusConfig
      const config = statusConfig[status]
      
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
    accessorKey: "userEventDetails",
    header: "Notes",
    cell: ({ row }) => {
      const notes = row.getValue("userEventDetails") as string | null
      return (
        <div className="max-w-[200px] truncate">
          {notes || <span className="text-muted-foreground">No notes</span>}
        </div>
      )
    },
  },
  {
    id: "telegram_return",
    header: "Return",
    cell: ({ row }) => {
      const booking = row.original
      
      // Only show return button for active bookings
      if (!canReturnBooking(booking.status)) {
        return null
      }

      const telegramLink = createTelegramBotLink(TELEGRAM_BOT_CONFIG.botUsername)
      
      return (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="flex items-center gap-2"
        >
          <a 
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Telegram bot to return equipment. Send /end_booking command."
          >
            <MessageCircle className="h-4 w-4" />
            {getReturnButtonText(booking.status)}
          </a>
        </Button>
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const booking = row.original

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
              onClick={() => navigator.clipboard.writeText(booking.id.toString())}
            >
              Copy booking ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link 
                to="/bookings/$" 
                params={{ _splat: booking.id.toString() }}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Edit booking</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Cancel booking
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]