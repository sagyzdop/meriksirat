import { useNavigate, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateBookingStatusAdminFn } from '@/lib/booking'
import { getBookingSlots } from '@/lib/booking/slots'
import { getBookingTimesFromSlots } from '@/components/shared/time-slot-picker'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Save, AlertCircle, ArrowLeft, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { EquipmentTable } from '@/components/shared/equipment-table'
import { BookingItemAction } from '@/components/shared/booking-item-action'
import { CancelBookingItemDialog } from '@/components/shared/cancel-booking-item-dialog'
import { AddEquipmentButton } from '@/components/shared/add-equipment-button'
import { BookingInfoTable } from '@/components/shared/booking-info-table'
import { BookingSchedule } from '@/components/shared/booking-schedule'
import { ExtendBookingButton } from '@/components/shared/extend-booking-button'
import { CancelBookingDialog } from '@/components/admin/bookings/$bookingId.edit/components/cancel-booking-dialog'
import { useAddBookingItems } from '@/hooks/use-add-booking-items'
import { useBackNavigation } from '@/hooks/use-back-navigation'
import type {
  AdminBookingWithDetails,
  BookingItemWithEquipment,
} from '@/lib/booking/types'

const editBookingSchema = z.object({
  notes: z.string().optional(),
})

type EditBookingForm = z.infer<typeof editBookingSchema>

interface PageProps {
  booking: AdminBookingWithDetails
  bookingId: number
  telegramBotUsername: string
}

export function Page({ booking, bookingId, telegramBotUsername }: PageProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const goBack = useBackNavigation('/admin/bookings')
  useAddBookingItems(bookingId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [pendingCancelItem, setPendingCancelItem] =
    useState<BookingItemWithEquipment | null>(null)

  const initialSlots = getBookingSlots(booking.startTime, booking.endTime)
  const [selectedSlots, setSelectedSlots] = useState<string[]>(initialSlots)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(booking.startTime)
  )

  const form = useForm<EditBookingForm>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      notes: booking.userEventDetails || '',
    },
  })

  const canEditSchedule = booking.status === 'booked'
  const items = booking.items ?? []
  const hasCalendar = items.some((item) => item.equipment?.googleCalendarId)

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
        onCancelItem={canEditSchedule ? setPendingCancelItem : undefined}
        disabled={isSubmitting}
      />
    ),
  }))

  const addEquipmentButton = canEditSchedule ? (
    <AddEquipmentButton
      bookingId={bookingId}
      returnTo={`/admin/bookings/${bookingId}/edit`}
    />
  ) : undefined

  const user = booking.user
  const bookedBy = user
    ? {
        id: user.id,
        name:
          `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
          user.email ||
          'Unknown',
        image: user.image,
      }
    : null

  const onSubmit = async (data: EditBookingForm) => {
    const times =
      canEditSchedule && hasCalendar
        ? getBookingTimesFromSlots(selectedSlots, selectedDate)
        : null

    if (canEditSchedule && hasCalendar && !times) {
      setError('Please select at least one time slot to update the schedule.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const requestData: {
        bookingId: number
        notes?: string
        startTime?: string
        endTime?: string
      } = {
        bookingId,
        notes: data.notes,
      }

      if (times) {
        const hasScheduleChange =
          times.startTime.getTime() !== new Date(booking.startTime).getTime() ||
          times.endTime.getTime() !== new Date(booking.endTime).getTime()

        if (hasScheduleChange) {
          requestData.startTime = times.startTime.toISOString()
          requestData.endTime = times.endTime.toISOString()
        }
      }

      await updateBookingStatusAdminFn({
        data: requestData,
      })

      setSuccess(
        'Booking updated successfully! Database and calendar have been synchronized.'
      )

      setTimeout(() => {
        navigate({ to: '/admin/bookings' })
      }, 2000)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update booking. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleItemCancelled = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bookings'] })
    router.invalidate()
  }

  const isOverdue =
    new Date(booking.endTime) < new Date() &&
    (booking.status === 'active' || booking.status === 'partially_returned')

  return (
    <PageContainer>
      <PageHeader title="Edit Booking" onBack={goBack} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {isOverdue && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This booking is overdue! The equipment was due on{' '}
                {format(new Date(booking.endTime), 'PPP p')}.
              </AlertDescription>
            </Alert>
          )}

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

          <Section title="Notes" spacing="compact">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes about this booking..."
                      className="min-h-[120px]"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          {canEditSchedule && (
            <BookingSchedule
              items={items}
              startTime={booking.startTime}
              endTime={booking.endTime}
              canEdit
              initialSlots={initialSlots}
              disabled={isSubmitting}
              onSlotsChange={(slots, date) => {
                setSelectedSlots(slots)
                setSelectedDate(date)
              }}
            />
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-end">
            {canEditSchedule && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowCancelDialog(true)}
                disabled={isSubmitting}
                className="flex w-full items-center gap-2 sm:w-auto sm:mr-auto"
              >
                <Trash2 className="h-4 w-4" />
                Cancel Booking
              </Button>
            )}
            <ExtendBookingButton
              bookingId={booking.id}
              status={booking.status}
              disabled={isSubmitting}
              onExtend={() => router.invalidate()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={isSubmitting}
              className="flex w-full items-center gap-2 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center gap-2 sm:w-auto"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>

      <CancelBookingDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        bookingId={bookingId}
        onCancelled={() => navigate({ to: '/admin/bookings' })}
        onError={(message) => setError(message)}
      />

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
