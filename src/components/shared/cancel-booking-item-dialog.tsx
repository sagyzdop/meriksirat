import { useState } from 'react'
import { toast } from 'sonner'
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
import { cancelBookingItemFn } from '@/lib/booking'
import type { BookingItemWithEquipment } from '@/lib/booking/types'

interface CancelBookingItemDialogProps {
  bookingId: number
  item: BookingItemWithEquipment | null
  onOpenChange: (open: boolean) => void
  onCancelled?: () => void
}

export function CancelBookingItemDialog({
  bookingId,
  item,
  onOpenChange,
  onCancelled,
}: CancelBookingItemDialogProps) {
  const [isCancelling, setIsCancelling] = useState(false)

  const itemName =
    item?.equipment?.modelName ??
    (item ? `Equipment ${item.equipmentId}` : 'this item')

  const handleCancel = async () => {
    if (!item) return
    setIsCancelling(true)
    try {
      await cancelBookingItemFn({
        data: { bookingId, itemId: item.id },
      })
      toast.success('Item cancelled successfully')
      onOpenChange(false)
      onCancelled?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel item'
      )
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <AlertDialog open={item !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Item</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel <strong>{itemName}</strong> from
            this booking? This action cannot be undone and the calendar event
            for this item will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>
            Keep Item
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isCancelling}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Item'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
