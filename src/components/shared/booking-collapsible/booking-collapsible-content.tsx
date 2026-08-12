import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { BookingStatusBadge } from '@/components/shared/booking-status-badge'
import { format } from 'date-fns'
import {
  CalendarCheck2,
  ClipboardCopy,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { BookingCollapsibleRowData } from './types'

interface BookingCollapsibleContentProps {
  booking: BookingCollapsibleRowData
  canEdit?: (booking: BookingCollapsibleRowData) => boolean
  onViewDetails?: () => void
  onEdit?: () => void
  onCancel?: () => void
  onDelete?: () => void
  onCopyId?: () => void
  onViewEquipment?: () => void
}

function getDefaultCanEdit(booking: BookingCollapsibleRowData) {
  return booking.status !== 'cancelled' && booking.status !== 'returned'
}

export function BookingCollapsibleContent({
  booking,
  canEdit,
  onViewDetails,
  onEdit,
  onCancel,
  onDelete,
  onCopyId,
  onViewEquipment,
}: BookingCollapsibleContentProps) {
  const editable = canEdit ? canEdit(booking) : getDefaultCanEdit(booking)

  return (
    <div className="space-y-4 border-t px-4 py-3">
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Created</p>
          <p className="mt-0.5 tabular-nums">
            {format(new Date(booking.createdAt), 'MMM dd, yyyy HH:mm')}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Booking ID
          </p>
          <p className="mt-0.5 font-mono tabular-nums">#{booking.id}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <div className="mt-0.5">
            <BookingStatusBadge
              status={booking.status}
              endTime={booking.endTime}
              showOverdueIcon
            />
          </div>
        </div>
        {booking.user && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Booked by
            </p>
            <p className="mt-0.5 truncate">
              {`${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim() ||
                booking.user.email ||
                'Unknown User'}
            </p>
          </div>
        )}
      </div>

      {booking.userEventDetails && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Notes</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">
            {booking.userEventDetails}
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground">Equipment</p>
        <ul className="mt-1.5 space-y-1.5">
          {booking.items.length === 0 && (
            <li className="text-sm text-muted-foreground">
              No equipment items
            </li>
          )}
          {booking.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
            >
              <span className="font-medium">
                {item.equipment?.modelName ?? `Equipment ${item.equipmentId}`}
              </span>
              <Badge variant="outline" className="text-xs">
                {item.status}
              </Badge>
              {item.googleCalendarEventId && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarCheck2 className="h-3 w-3" />
                  Calendar event synced
                </span>
              )}
              {item.returnedAt && (
                <span className="text-xs text-muted-foreground">
                  Returned {format(new Date(item.returnedAt), 'MMM dd, HH:mm')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        {onViewDetails && (
          <Button size="sm" variant="outline" onClick={onViewDetails}>
            View details
          </Button>
        )}
        {editable && onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
        {onViewEquipment && (
          <Button size="sm" variant="ghost" onClick={onViewEquipment}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            View equipment
          </Button>
        )}
        {onCopyId && (
          <Button size="sm" variant="ghost" onClick={onCopyId}>
            <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
            Copy ID
          </Button>
        )}
        {onCancel && (
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            onClick={onCancel}
          >
            Cancel booking
          </Button>
        )}
        {onDelete && (
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            onClick={onDelete}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}
