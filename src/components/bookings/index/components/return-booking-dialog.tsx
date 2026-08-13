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
import { returnBookingFn } from '@/lib/booking'

interface ReturnBookingDialogProps {
  booking: BookingWithItems | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ReturnBookingDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: ReturnBookingDialogProps) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = React.useState(false)

  if (!booking) return null

  const handleReturn = async () => {
    setIsLoading(true)
    try {
      await returnBookingFn({
        data: {
          bookingId: booking.id,
        },
      })

      toast.success('Booking returned successfully')

      // Refresh the bookings list in the background
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })

      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error returning booking:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to return booking'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Return Booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to return this booking
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
            ? The equipment will be marked as returned.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleReturn()
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Returning...' : 'Yes, return booking'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
