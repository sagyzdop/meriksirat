import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import {
  bookingsQueries,
  checkThirtyMinuteExtension,
  getClubLocalParts,
  minutesToTime,
} from '@/lib/booking'
import { extendBookingByThirtyMinutesFn } from '@/lib/booking'

interface ExtendBookingButtonProps {
  bookingId: number
  status?: string
  endTime?: Date | string
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
 * 30 minutes. For overdue bookings, the overdue status and counter increment
 * are only undone when the extended end time is still in the future. Available
 * to both the booking owner and admins.
 */
export function ExtendBookingButton({
  bookingId,
  status,
  endTime,
  disabled = false,
  onExtend,
  className,
}: ExtendBookingButtonProps) {
  const queryClient = useQueryClient()
  const { data: bookingSettings } = useQuery(bookingsQueries.settings())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [warningOpen, setWarningOpen] = useState(false)
  const [isExtending, setIsExtending] = useState(false)

  if (status && !EXTENDABLE_STATUSES.includes(status)) return null

  const operatingHoursEnd = bookingSettings?.operatingHoursEnd ?? 1439
  const extensionCheck =
    endTime === undefined
      ? { allowed: true }
      : checkThirtyMinuteExtension(endTime, operatingHoursEnd)

  const handleOpenClick = () => {
    if (extensionCheck.allowed) {
      setConfirmOpen(true)
    } else {
      setWarningOpen(true)
    }
  }

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
      setConfirmOpen(false)
      onExtend?.(result)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to extend the booking'
      )
    } finally {
      setIsExtending(false)
    }
  }

  const endTimeLabel =
    endTime !== undefined
      ? minutesToTime(getClubLocalParts(endTime).minutes)
      : null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={handleOpenClick}
        className={className}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add 30 min
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Extend this booking by 30 minutes?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The equipment availability is checked right now. If every item is
              free for the extra 30 minutes, the booking end time will be moved
              30 minutes later
              {status === 'overdue' &&
                ' and, if the new end time is still in the future, the overdue status will be reset'}
              . Calendar events are updated automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExtending}>
              Not now
            </AlertDialogCancel>
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

      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This booking can't be extended</AlertDialogTitle>
            <AlertDialogDescription>
              {extensionCheck.reason === 'midnight'
                ? `This booking ends at ${endTimeLabel}. Adding 30 minutes would cross midnight, which is not allowed.`
                : `This booking ends at ${endTimeLabel}, which is at the end of the club's operating hours. Adding 30 minutes would go past closing time.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
