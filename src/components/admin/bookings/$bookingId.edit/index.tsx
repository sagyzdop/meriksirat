import { useNavigate, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { updateBookingStatusAdminFn, cancelBookingItemFn } from '@/lib/booking'
import { getBookingSlots } from '@/lib/booking/slots'
import { getBookingTimesFromSlots } from '@/components/shared/time-slot-picker'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Save, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { BookingEquipmentTable } from '@/components/shared/booking-equipment-table'
import { BookingInfoTable } from '@/components/shared/booking-info-table'
import { BookingSchedule } from '@/components/shared/booking-schedule'
import { ExtendBookingButton } from '@/components/shared/extend-booking-button'
import { CancelBookingDialog } from '@/components/admin/bookings/$bookingId.edit/components/cancel-booking-dialog'
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [pendingCancelItem, setPendingCancelItem] =
    useState<BookingItemWithEquipment | null>(null)
  const [isCancellingItem, setIsCancellingItem] = useState(false)

  const initialSlots = getBookingSlots(booking.startTime, booking.endTime)
  const [selectedSlots, setSelectedSlots] = useState<string[]>(initialSlots)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(booking.startTime)
  )

  const form = useForm<EditBookingForm>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      notes: '',
    },
  })

  const canEditSchedule = booking.status === 'booked'
  const items = booking.items ?? []
  const hasCalendar = items.some((item) => item.equipment?.googleCalendarId)

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
    } catch (cancelError) {
      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : 'Failed to cancel item'
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

  const isOverdue =
    new Date(booking.endTime) < new Date() &&
    (booking.status === 'active' || booking.status === 'partially_returned')

  return (
    <PageContainer>
      <PageHeader
        title="Edit Booking"
        backTo="/admin/bookings"
        backLabel="Back to Bookings"
      />

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

          <Section
            title="Details"
            description="Administrative context for this booking"
            spacing="compact"
          >
            <BookingInfoTable booking={booking} bookedBy={bookedBy} />
          </Section>

          <Section
            title="Equipment"
            description="Cancel an item to remove it from this booking, or return equipment through Telegram once the booking is active."
            spacing="compact"
          >
            {items.length > 0 ? (
              <BookingEquipmentTable
                items={items}
                bookingStatus={booking.status}
                telegramBotUsername={telegramBotUsername}
                onCancelItem={
                  canEditSchedule ? setPendingCancelItem : undefined
                }
                disabled={isSubmitting}
                actionsFirst
              />
            ) : (
              <div className="relative rounded-md border py-12 text-center text-muted-foreground">
                Equipment details not available
              </div>
            )}
          </Section>

          <Section
            title="Admin Notes"
            description="Add administrative notes. Status changes are handled by the Cancel Booking button."
            spacing="compact"
          >
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Administrative Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add administrative notes about this booking update (optional)..."
                      className="min-h-[120px]"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    These notes will be appended to the booking history and
                    visible to other admins. Your email will be automatically
                    included with the note.
                  </FormDescription>
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
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
              disabled={isSubmitting}
              className="w-full sm:w-auto sm:mr-auto"
            >
              Cancel Booking
            </Button>
            <ExtendBookingButton
              bookingId={booking.id}
              status={booking.status}
              disabled={isSubmitting}
              onExtend={() => router.invalidate()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: '/admin/bookings' })}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 w-full sm:w-auto"
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
