import { format } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BookingStatusBadge } from '@/components/shared/booking-status-badge'
import type { BookingWithItems } from '@/lib/booking/types'

export interface BookingInfoTableBookedBy {
  id: string
  name: string
  image?: string | null
}

interface BookingInfoTableProps {
  booking: BookingWithItems
  bookedBy?: BookingInfoTableBookedBy | null
  showBookingDay?: boolean
}

function formatTime(date: Date) {
  return format(date, 'HH:mm')
}

/**
 * Shared "Details" table used by the booking detail and edit pages (and the
 * collapsible list content). Renders the booking identity, the booker (admin
 * only), the booking day plus time-only start/end rows, actual start/return
 * when present, and the creation time with a full weekday name.
 */
export function BookingInfoTable({
  booking,
  bookedBy,
  showBookingDay = true,
}: BookingInfoTableProps) {
  const actualReturn = booking.items.reduce<Date | null>((max, item) => {
    if (!item.returnedAt) return max
    return !max || item.returnedAt > max ? item.returnedAt : max
  }, null)

  const initials = bookedBy
    ? bookedBy.name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  return (
    <div className="relative rounded-md border overflow-x-auto">
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
              ID
            </TableCell>
            <TableCell className="whitespace-nowrap">#{booking.id}</TableCell>
          </TableRow>

          {bookedBy && (
            <TableRow>
              <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                Booked by
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Link
                  to="/admin/users/$userId"
                  params={{ userId: bookedBy.id }}
                  className="flex items-center gap-2 font-medium hover:underline"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={bookedBy.image || undefined} alt={bookedBy.name} />
                    <AvatarFallback className="text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {bookedBy.name}
                </Link>
              </TableCell>
            </TableRow>
          )}

          <TableRow>
            <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
              Status
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <BookingStatusBadge
                status={booking.status}
                endTime={booking.endTime}
                colorized
              />
            </TableCell>
          </TableRow>

          {showBookingDay && (
            <TableRow>
              <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                Booking Day
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {format(new Date(booking.startTime), 'EEEE, MMMM d, yyyy')}
              </TableCell>
            </TableRow>
          )}

          <TableRow>
            <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
              Start Time
            </TableCell>
            <TableCell className="whitespace-nowrap font-medium tabular-nums">
              {formatTime(new Date(booking.startTime))}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
              End Time
            </TableCell>
            <TableCell className="whitespace-nowrap font-medium tabular-nums">
              {formatTime(new Date(booking.endTime))}
            </TableCell>
          </TableRow>

          {booking.startedAt && (
            <TableRow>
              <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                Actual Start
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {format(new Date(booking.startedAt), 'EEE, MMM d, yyyy HH:mm')}
              </TableCell>
            </TableRow>
          )}

          {actualReturn && (
            <TableRow>
              <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                Actual Return
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {format(new Date(actualReturn), 'EEE, MMM d, yyyy HH:mm')}
              </TableCell>
            </TableRow>
          )}

          <TableRow>
            <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
              Created At
            </TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">
              {format(new Date(booking.createdAt), 'EEEE, MMM d, yyyy, HH:mm')}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
