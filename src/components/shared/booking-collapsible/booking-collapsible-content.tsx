import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { BookingStatusBadge } from '@/components/shared/booking-status-badge'
import { ExtendBookingButton } from '@/components/shared/extend-booking-button'
import { cancelBookingItemFn } from '@/lib/booking'
import { createTelegramBotLink } from '@/lib/telegram/client-utils'
import { cn } from '@/lib/utils'
import { ArrowRight, Clock } from 'lucide-react'
import type { BookingItemWithEquipment } from '@/lib/booking/types'
import type { BookingCollapsibleRowData } from './types'

interface BookingCollapsibleContentProps {
  booking: BookingCollapsibleRowData
  telegramBotUsername?: string
  canEdit?: (booking: BookingCollapsibleRowData) => boolean
  onViewDetails?: () => void
  onEdit?: () => void
  onCancel?: () => void
}

function getDefaultCanEdit(booking: BookingCollapsibleRowData) {
  return booking.status === 'booked'
}

function getItemStatusBadgeVariant(status: string) {
  switch (status) {
    case 'cancelled':
    case 'overdue':
      return 'destructive' as const
    case 'returned':
      return 'outline' as const
    case 'active':
      return 'default' as const
    default:
      return 'secondary' as const
  }
}

function EquipmentBlock({
  item,
  bookingStatus,
  telegramBotUsername,
  onCancelItem,
}: {
  item: BookingItemWithEquipment
  bookingStatus: string
  telegramBotUsername?: string
  onCancelItem?: (item: BookingItemWithEquipment) => void
}) {
  const equipment = item.equipment
  const modelName = equipment?.modelName ?? `Equipment ${item.equipmentId}`
  const canReturn =
    bookingStatus === 'active' ||
    bookingStatus === 'partially_returned' ||
    bookingStatus === 'overdue'
  const isHeld = item.status === 'cancelled' || item.status === 'returned'

  return (
    <li className="flex items-center gap-3 rounded-md border bg-card p-2">
      <Link
        to="/equipment/$"
        params={{ _splat: equipment?.id.toString() ?? '' }}
        className="shrink-0"
      >
        <img
          src={
            equipment?.imagePath
              ? `/api/images/${equipment.imagePath}`
              : '/equipment-placeholder.svg'
          }
          alt={modelName}
          className="h-10 w-14 rounded-md border object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/equipment/$"
          params={{ _splat: equipment?.id.toString() ?? '' }}
          className="block truncate font-medium hover:underline"
        >
          {modelName}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {equipment?.category?.name ?? 'Uncategorized'}
          </Badge>
          {item.status !== 'booked' && (
            <Badge
              variant={getItemStatusBadgeVariant(item.status)}
              className="text-xs"
            >
              {item.status}
            </Badge>
          )}
          {item.returnedAt && (
            <span className="text-xs text-muted-foreground">
              Returned {format(new Date(item.returnedAt), 'MMM dd, HH:mm')}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {isHeld ? (
          <span className="text-sm text-muted-foreground capitalize">
            {item.status}
          </span>
        ) : bookingStatus === 'booked' && onCancelItem ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancelItem(item)}
          >
            Cancel item
          </Button>
        ) : canReturn && telegramBotUsername ? (
          <Button variant="outline" size="sm" asChild>
            <a
              href={createTelegramBotLink(telegramBotUsername)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open the Telegram bot to return this item. Send /return_equipment."
            >
              Return
            </a>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

export function BookingCollapsibleContent({
  booking,
  telegramBotUsername,
  canEdit,
  onViewDetails,
  onEdit,
  onCancel,
}: BookingCollapsibleContentProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const editable = canEdit ? canEdit(booking) : getDefaultCanEdit(booking)
  const [pendingCancelItem, setPendingCancelItem] =
    useState<BookingItemWithEquipment | null>(null)
  const [isCancellingItem, setIsCancellingItem] = useState(false)

  const isOverdue =
    booking.status === 'overdue' ||
    booking.items.some((item) => item.status === 'overdue')

  const handleCancelItem = async () => {
    if (!pendingCancelItem) return
    setIsCancellingItem(true)
    try {
      await cancelBookingItemFn({
        data: {
          bookingId: booking.id,
          itemId: pendingCancelItem.id,
        },
      })
      toast.success('Item cancelled successfully')
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      router.invalidate()
      setPendingCancelItem(null)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel item'
      )
    } finally {
      setIsCancellingItem(false)
    }
  }

  const pendingItemName =
    pendingCancelItem?.equipment?.modelName ??
    (pendingCancelItem
      ? `Equipment ${pendingCancelItem.equipmentId}`
      : 'this item')

  return (
    <div className="space-y-4 border-t px-4 py-4">
      <div
        className={cn(
          'flex flex-col gap-2 rounded-md bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
          isOverdue && 'bg-destructive/10'
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {format(new Date(booking.startTime), 'EEEE, MMMM d, yyyy')}
        </div>
        <div
          className={cn(
            'flex items-center gap-2 text-sm tabular-nums',
            isOverdue ? 'text-destructive' : ''
          )}
        >
          <span className="font-semibold">
            {format(new Date(booking.startTime), 'HH:mm')}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold">
            {format(new Date(booking.endTime), 'HH:mm')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Created</p>
          <p className="mt-0.5 tabular-nums">
            {format(new Date(booking.createdAt), 'EEEE, MMM d, HH:mm')}
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
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Equipment
          </p>
          <p className="text-xs text-muted-foreground">
            {booking.items.length} item{booking.items.length === 1 ? '' : 's'}
          </p>
        </div>
        {booking.items.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            No equipment items
          </p>
        ) : (
          <ul className="mt-1.5 space-y-2">
            {booking.items.map((item) => (
              <EquipmentBlock
                key={item.id}
                item={item}
                bookingStatus={booking.status}
                telegramBotUsername={telegramBotUsername}
                onCancelItem={setPendingCancelItem}
              />
            ))}
          </ul>
        )}
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        <ExtendBookingButton
          bookingId={booking.id}
          status={booking.status}
          onExtend={() => router.invalidate()}
        />
        {onViewDetails && (
          <Button size="sm" variant="outline" onClick={onViewDetails}>
            View details
          </Button>
        )}
        {editable && onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
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
      </div>

      <AlertDialog
        open={pendingCancelItem !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancelItem(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel{' '}
              <strong>{pendingItemName}</strong> from this booking? This action
              cannot be undone and the calendar event for this item will be
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingItem}>
              Keep Item
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelItem}
              disabled={isCancellingItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancellingItem ? 'Cancelling...' : 'Cancel Item'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
