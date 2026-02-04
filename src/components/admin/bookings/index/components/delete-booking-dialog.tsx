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
import { toast } from "sonner"
import type { AdminBookingWithDetails } from "@/lib/booking/types"
import { deleteBookingAdminFn } from "@/lib/booking/functions/admin-bookings"


interface DeleteBookingDialogProps {
  booking: AdminBookingWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DeleteBookingDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: DeleteBookingDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteBookingAdminFn({ data: { bookingId: booking.id } })

      toast.success("Booking deleted successfully")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error("Failed to delete booking", {
        description: error instanceof Error ? error.message : "An error occurred",
      })
    } finally {
      setIsDeleting(false)
    }
  }


  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the booking
            for {booking.user ? `${booking.user.firstName || ""} ${booking.user.lastName || ""}`.trim() || "Unknown User" : "Unknown User"} and remove the data from the
            system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isDeleting}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onOpenChange(false)
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
