import { useState } from 'react'
import { updateBookingStatusAdminFn } from '@/lib/booking'
import { FormLabel } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
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

interface CancelBookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: number
  onCancelled: () => void
  onError: (message: string) => void
}

export function CancelBookingDialog({
  open,
  onOpenChange,
  bookingId,
  onCancelled,
  onError,
}: CancelBookingDialogProps) {
  const [cancelNotes, setCancelNotes] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancelBooking = async () => {
    setIsCancelling(true)
    try {
      await updateBookingStatusAdminFn({
        data: {
          bookingId,
          status: 'cancelled',
          notes: cancelNotes || 'Booking cancelled by admin',
        },
      })
      onOpenChange(false)
      onCancelled()
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to cancel booking. Please try again.'
      )
      onOpenChange(false)
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel booking #{bookingId}? This action
            cannot be undone and all calendar events for this booking will be
            removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <FormLabel>Reason (optional)</FormLabel>
          <Textarea
            value={cancelNotes}
            onChange={(e) => setCancelNotes(e.target.value)}
            placeholder="Add a reason for cancelling (optional)..."
            disabled={isCancelling}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>
            Keep Booking
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancelBooking}
            disabled={isCancelling}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
