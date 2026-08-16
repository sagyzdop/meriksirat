import { useNavigate, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { updateBookingFn, cancelBookingFn } from '@/lib/booking'
import { getBookingSlots } from '@/lib/booking/slots'
import { getBookingTimesFromSlots } from '@/components/shared/time-slot-picker'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save, X } from 'lucide-react'
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
import { ExtendBookingButton } from '@/components/shared/extend-booking-button'
import { useAddBookingItems } from '@/hooks/use-add-booking-items'
import { useBackNavigation } from '@/hooks/use-back-navigation'
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
  const goBack = useBackNavigation('/bookings')
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
          notes,
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
      <PageHeader title="Edit Booking" onBack={goBack} />
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
            <Section title="Notes" spacing="compact">
              <Textarea
                placeholder="Add any notes about this booking..."
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
          <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isSubmitting || isCancelling}
                  className="flex w-full items-center gap-2 sm:w-auto sm:mr-auto"
                >
                  <X className="h-4 w-4" />
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

            <ExtendBookingButton
              bookingId={booking.id}
              status={booking.status}
              endTime={booking.endTime}
              disabled={isSubmitting}
              onExtend={() => router.invalidate()}
            />
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex w-full items-center gap-2 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={onSubmit}
              disabled={isSubmitting || selectedSlots.length === 0}
              className="flex w-full items-center gap-2 sm:w-auto"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
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
