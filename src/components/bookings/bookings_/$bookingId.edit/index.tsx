import { useNavigate, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { updateBookingFn, cancelBookingFn } from '@/lib/booking'
import { getBookingSlots } from '@/lib/booking/slots'
import { getBookingTimesFromSlots } from '@/components/shared/time-slot-picker'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { EquipmentTable } from '@/components/shared/equipment-table'
import { BookingItemAction } from '@/components/shared/booking-item-action'
import { CancelBookingItemDialog } from '@/components/shared/cancel-booking-item-dialog'
import { AddEquipmentButton } from '@/components/shared/add-equipment-button'
import { BookingInfoTable } from '@/components/shared/booking-info-table'
import type { BookingInfoTableBookedBy } from '@/components/shared/booking-info-table'
import { BookingSchedule } from '@/components/shared/booking-schedule'
import { useAddBookingItems } from '@/hooks/use-add-booking-items'
import type {
  BookingWithItems,
  BookingItemWithEquipment,
} from '@/lib/booking/types'

interface PageProps {
  booking: BookingWithItems
  bookingId: number
  telegramBotUsername: string
  bookedBy?: BookingInfoTableBookedBy | null
}

export function Page({
  booking,
  bookingId,
  telegramBotUsername,
  bookedBy,
}: PageProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  useAddBookingItems(bookingId)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isCancelling, setIsCancelling] = React.useState(false)
  const [pendingCancelItem, setPendingCancelItem] =
    React.useState<BookingItemWithEquipment | null>(null)

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

  const rows = items.map((item) => ({
    key: item.id.toString(),
    equipmentId: item.equipmentId,
    title: item.equipment?.modelName ?? `Equipment ${item.equipmentId}`,
    imagePath: item.equipment?.imagePath,
    categoryName: item.equipment?.category?.name,
    action: (
      <BookingItemAction
        item={item}
        bookingStatus={booking.status}
        telegramBotUsername={telegramBotUsername}
        onCancelItem={canEdit ? setPendingCancelItem : undefined}
        disabled={isSubmitting}
      />
    ),
  }))

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

  const handleItemCancelled = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bookings'] })
    router.invalidate()
  }

  const handleBack = () => {
    navigate({ to: '/bookings' })
  }

  const addEquipmentButton = canEdit ? (
    <AddEquipmentButton
      bookingId={bookingId}
      returnTo={`/bookings/${bookingId}/edit`}
    />
  ) : undefined

  return (
    <PageContainer>
      <PageHeader title="Edit Booking" onBack={() => history.back()} />

      <div className="space-y-8">
        <Section title="Details" spacing="compact">
          <BookingInfoTable booking={booking} bookedBy={bookedBy} />
        </Section>

        <Section
          title="Equipment"
          spacing="compact"
          actions={addEquipmentButton}
        >
          <EquipmentTable
            rows={rows}
            emptyMessage="Equipment details not available"
            emptyAction={addEquipmentButton}
          />
        </Section>

        {canEdit && (
          <>
            <Section title="Update Notes" spacing="compact">
              <Textarea
                placeholder="Add any notes about your booking..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                disabled={isSubmitting}
              />
            </Section>

            <BookingSchedule
              items={items}
              startTime={booking.startTime}
              endTime={booking.endTime}
              canEdit
              initialSlots={initialSlots}
              disabled={isSubmitting}
              onSlotsChange={handleSlotsChange}
            />
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

      <CancelBookingItemDialog
        bookingId={bookingId}
        item={pendingCancelItem}
        onOpenChange={(open) => {
          if (!open) setPendingCancelItem(null)
        }}
        onCancelled={handleItemCancelled}
      />
    </PageContainer>
  )
}
