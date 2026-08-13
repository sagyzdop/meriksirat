import { useNavigate, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  updateBookingFn,
  cancelBookingFn,
  cancelBookingItemFn,
} from '@/lib/booking'
import { getBookingSlots } from '@/lib/booking/slots'
import { getBookingTimesFromSlots } from '@/components/shared/time-slot-picker'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { format } from 'date-fns'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { BookingEquipmentTable } from '@/components/shared/booking-equipment-table'
import { BookingInfoTable } from '@/components/shared/booking-info-table'
import { BookingSchedule } from '@/components/shared/booking-schedule'
import type {
  BookingWithItems,
  BookingItemWithEquipment,
} from '@/lib/booking/types'

interface PageProps {
  booking: BookingWithItems
  bookingId: number
  telegramBotUsername: string
}

export function Page({ booking, bookingId, telegramBotUsername }: PageProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isCancelling, setIsCancelling] = React.useState(false)
  const [pendingCancelItem, setPendingCancelItem] =
    React.useState<BookingItemWithEquipment | null>(null)
  const [isCancellingItem, setIsCancellingItem] = React.useState(false)

  const [selectedSlots, setSelectedSlots] = React.useState<string[]>([])
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>()
  const [notes, setNotes] = React.useState(booking.userEventDetails || '')

  const initialSlots = React.useMemo(
    () => getBookingSlots(booking.startTime, booking.endTime),
    [booking.startTime, booking.endTime]
  )

  const handleSlotsChange = (slots: string[], date: Date | undefined) => {
    setSelectedSlots(slots)
    setSelectedDate(date)
  }

  const canEdit = booking.status === 'booked'
  const items = booking.items ?? []

  const onSubmit = async () => {
    const times = getBookingTimesFromSlots(selectedSlots, selectedDate)
    if (!times) {
      toast.error('Please select at least one time slot')
      return
    }

    setIsSubmitting(true)

    try {
      await updateBookingFn({
        data: {
          bookingId,
          startTime: times.startTime.toISOString(),
          endTime: times.endTime.toISOString(),
          notes: notes || undefined,
        },
      })

      toast.success('Booking updated successfully!')

      setTimeout(() => {
        navigate({ to: '/bookings' })
      }, 1500)
    } catch (error) {
      console.error('Failed to update booking:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update booking. Please try again.'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)

    try {
      await cancelBookingFn({
        data: { bookingId },
      })

      toast.success('Booking cancelled successfully!')

      setTimeout(() => {
        navigate({ to: '/bookings' })
      }, 1500)
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to cancel booking. Please try again.'
      toast.error(errorMessage)
    } finally {
      setIsCancelling(false)
    }
  }

  const handleCancelItem = async () => {
    if (!pendingCancelItem) return
    setIsCancellingItem(true)
    try {
      await cancelBookingItemFn({
        data: {
          bookingId,
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

  const handleBack = () => {
    navigate({ to: '/bookings' })
  }

  return (
    <PageContainer>
      <PageHeader
        title="Edit Booking"
        description={`Booking ID: #${booking.id} • Created ${format(new Date(booking.createdAt), 'PPP')}`}
        backTo="/bookings"
        backLabel="Back to Bookings"
      />

      <div className="space-y-8">
        <Section title="Details" spacing="compact">
          <BookingInfoTable booking={booking} />
        </Section>

        <Section
          title="Equipment"
          description="Cancel an item to remove it from this booking."
          spacing="compact"
        >
          {items.length > 0 ? (
            <BookingEquipmentTable
              items={items}
              bookingStatus={booking.status}
              telegramBotUsername={telegramBotUsername}
              onCancelItem={canEdit ? setPendingCancelItem : undefined}
              disabled={isSubmitting}
              actionsFirst
            />
          ) : (
            <div className="relative rounded-md border py-12 text-center text-muted-foreground">
              Equipment details not available
            </div>
          )}
        </Section>

        {canEdit && (
          <>
            <BookingSchedule
              items={items}
              startTime={booking.startTime}
              endTime={booking.endTime}
              canEdit
              initialSlots={initialSlots}
              disabled={isSubmitting}
              onSlotsChange={handleSlotsChange}
            />

            <Section title="Update Notes" spacing="compact">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about your booking..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>
            </Section>
          </>
        )}

        {canEdit && (
          <div className="flex flex-col justify-end gap-4 sm:flex-row">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isSubmitting || isCancelling}
                  className="flex w-full items-center gap-2 sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this booking? This action
                    cannot be undone. The calendar event will be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isCancelling}>
                    No, keep it
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isCancelling ? 'Cancelling...' : 'Yes, cancel booking'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              onClick={onSubmit}
              disabled={isSubmitting || selectedSlots.length === 0}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(pendingCancelItem)}
        onOpenChange={(open) => {
          if (!open) setPendingCancelItem(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel <strong>{pendingItemName}</strong>{' '}
              from this booking? This cannot be undone and the calendar event
              for this item will be removed.
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
    </PageContainer>
  )
}
