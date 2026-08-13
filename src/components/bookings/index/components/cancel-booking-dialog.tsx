import * as React from 'react'
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
import { BookingWithItems } from '@/lib/booking/types'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { cancelBookingFn } from '@/lib/booking'

interface CancelBookingDialogProps {
  booking: BookingWithItems | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CancelBookingDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: CancelBookingDialogProps) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = React.useState(false)

  if (!booking) return null

  const handleCancel = async () => {
    setIsLoading(true)
    try {
      await cancelBookingFn({
        data: {
          bookingId: booking.id,
        },
      })

      toast.success('Booking cancelled successfully')

      // Refresh the bookings list in the background
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })

      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel booking'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel this booking
            {booking.items.length > 0 && (
              <>
                {' '}
                for{' '}
                <strong>
                  {booking.items
                    .map(
                      (item) =>
                        item.equipment?.modelName ??
                        `Equipment ${item.equipmentId}`
                    )
                    .join(', ')}
                </strong>
              </>
            )}
            ? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleCancel()
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Cancelling...' : 'Yes, cancel booking'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
