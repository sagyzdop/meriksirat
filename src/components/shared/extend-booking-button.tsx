import { useState } from 'react'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
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
import { Button } from '@/components/ui/button'
import { extendBookingByThirtyMinutesFn } from '@/lib/booking'

interface ExtendBookingButtonProps {
  bookingId: number
  status?: string
  disabled?: boolean
  onExtend?: (result: { newEndTime: string; undidOverdue: boolean }) => void
  className?: string
}

const EXTENDABLE_STATUSES = [
  'booked',
  'active',
  'partially_returned',
  'overdue',
]

/**
 * "Add 30 min" action for a booking. Runs the availability check on click via
 * the server; if all items are available the booking end time is extended by
 * 30 minutes and, for overdue bookings, the overdue counter increment is
 * undone. Available to both the booking owner and admins.
 */
export function ExtendBookingButton({
  bookingId,
  status,
  disabled = false,
  onExtend,
  className,
}: ExtendBookingButtonProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [isExtending, setIsExtending] = useState(false)

  if (status && !EXTENDABLE_STATUSES.includes(status)) return null

  const handleExtend = async () => {
    setIsExtending(true)
    try {
      const result = await extendBookingByThirtyMinutesFn({
        data: { bookingId },
      })
      toast.success(
        result.undidOverdue
          ? 'Booking extended by 30 minutes and the overdue status was reset'
          : 'Booking extended by 30 minutes'
      )
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setOpen(false)
      onExtend?.(result)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to extend the booking'
      )
    } finally {
      setIsExtending(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Clock className="mr-1.5 h-3.5 w-3.5" />
        Add 30 min
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extend this booking by 30 minutes?</AlertDialogTitle>
            <AlertDialogDescription>
              The equipment availability is checked right now. If every item is
              free for the extra 30 minutes, the booking end time will be moved
              30 minutes later
              {status === 'overdue' &&
                ' and the overdue counter increment will be undone'}
              . Calendar events are updated automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExtending}>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleExtend()
              }}
              disabled={isExtending}
            >
              {isExtending ? 'Checking availability...' : 'Extend booking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
