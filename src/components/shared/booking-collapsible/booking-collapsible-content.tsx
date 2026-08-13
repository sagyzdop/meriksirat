import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { ExtendBookingButton } from '@/components/shared/extend-booking-button'
import { EquipmentTable } from '@/components/shared/equipment-table'
import { BookingItemAction } from '@/components/shared/booking-item-action'
import { cancelBookingItemFn } from '@/lib/booking'
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
      <EquipmentTable
        rows={booking.items.map((item) => ({
          key: item.id.toString(),
          equipmentId: item.equipmentId,
          title: item.equipment?.modelName ?? `Equipment ${item.equipmentId}`,
          imagePath: item.equipment?.imagePath,
          categoryName: item.equipment?.category?.name,
          action: (
            <BookingItemAction
              item={item}
              bookingStatus={booking.status}
              telegramBotUsername={telegramBotUsername}
              onCancelItem={setPendingCancelItem}
            />
          ),
        }))}
        emptyMessage="No equipment items"
      />

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
              Are you sure you want to cancel <strong>{pendingItemName}</strong>{' '}
              from this booking? This action cannot be undone and the calendar
              event for this item will be removed.
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
