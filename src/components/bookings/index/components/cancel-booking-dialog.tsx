import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { BookingWithEquipment } from "@/lib/booking/types"
import { toast } from "sonner"
import { useRouter } from "@tanstack/react-router"
import { cancelBookingFn } from "@/lib/booking"

interface CancelBookingDialogProps {
  booking: BookingWithEquipment | null
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
  const router = useRouter()
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

      toast.success("Booking cancelled successfully")
      
      // Refresh the page to update the booking list
      router.invalidate()
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error cancelling booking:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel booking"
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
            Are you sure you want to cancel this booking for{" "}
            <strong>{booking.equipment?.modelName}</strong>? This action cannot
            be undone.
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
            {isLoading ? "Cancelling..." : "Yes, cancel booking"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
