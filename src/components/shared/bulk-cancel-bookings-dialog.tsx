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

interface BulkCancelBookingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cancellableCount: number
  totalSelectedCount: number
  isProcessing: boolean
  onConfirm: () => void
  calendarActionText: string
}

export function BulkCancelBookingsDialog({
  open,
  onOpenChange,
  cancellableCount,
  totalSelectedCount,
  isProcessing,
  onConfirm,
  calendarActionText,
}: BulkCancelBookingsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel selected bookings?</AlertDialogTitle>
          <AlertDialogDescription>
            {cancellableCount === 1
              ? `This will cancel 1 booking and ${calendarActionText}.`
              : `This will cancel ${cancellableCount} bookings and ${calendarActionText}.`}
            {totalSelectedCount > cancellableCount &&
              ' Bookings that are already cancelled or returned will be skipped.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>
            Keep bookings
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
            disabled={isProcessing}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isProcessing ? 'Cancelling...' : 'Yes, cancel'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
