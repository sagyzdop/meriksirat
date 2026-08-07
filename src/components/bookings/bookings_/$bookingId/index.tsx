import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { updateBookingFn, cancelBookingFn } from '@/lib/booking'
import { getBookingSlots } from '@/lib/booking/slots'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { format } from 'date-fns'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { getBookingTimesFromSlots } from '@/components/shared/time-slot-picker'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { EquipmentCard } from '@/components/shared/equipment-card'
import { BookingStatusBadge } from '@/components/shared/booking-status-badge'
import { BookingSchedule } from '@/components/shared/booking-schedule'

interface PageProps {
  booking: any
  bookingId: number
}

export function Page({ booking, bookingId }: PageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isCancelling, setIsCancelling] = React.useState(false)

  // Time slot selection state
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to update booking. Please try again.'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)

    try {
      await cancelBookingFn({
        data: { bookingId }
      })

      toast.success('Booking cancelled successfully!')
      
      setTimeout(() => {
        navigate({ to: '/bookings' })
      }, 1500)
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel booking. Please try again.'
      toast.error(errorMessage)
    } finally {
      setIsCancelling(false)
    }
  }

  const handleBack = () => {
    navigate({ to: '/bookings' })
  }

  const canEdit = booking.status === 'booked' || booking.status === 'active'
  const canCancel = booking.status !== 'cancelled' && booking.status !== 'returned'

  return (
    <PageContainer>
      <PageHeader
        title="Edit Booking"
        description={`Booking ID: #${booking.id} • Created ${format(new Date(booking.createdAt), 'PPP')}`}
        backTo="/bookings"
        backLabel="Back to Bookings"
        actions={<BookingStatusBadge status={booking.status} colorized />}
      />

      <div className="space-y-8">
        {!canEdit && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <p className="text-sm text-yellow-800">
                This booking cannot be edited because it has been <strong>{booking.status}</strong>. 
                You can only edit bookings that are booked or active.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Equipment Details */}
        <Section title="Equipment Details" spacing="compact">
          {booking.items?.length > 0 ? (
            <div className="space-y-3">
              {booking.items.map((item: any) => (
                <EquipmentCard
                  key={item.id}
                  item={{
                    id: item.equipmentId,
                    imagePath: item.equipment?.imagePath ?? null,
                    modelName: item.equipment?.modelName || 'Unknown Equipment',
                    description: item.equipment?.description ?? null,
                    category: item.equipment?.category ?? null,
                  }}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Equipment details not available</p>
              </CardContent>
            </Card>
          )}
        </Section>

        {/* Current Booking / Availability / Update Date & Time */}
        <BookingSchedule
          items={booking.items ?? []}
          startTime={booking.startTime}
          endTime={booking.endTime}
          currentNotes={booking.userEventDetails}
          canEdit={canEdit}
          initialSlots={initialSlots}
          disabled={isSubmitting}
          onSlotsChange={handleSlotsChange}
        />

        {/* Notes Section */}
        {canEdit && (
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
        )}

        {/* Action Buttons */}
        {canEdit && (
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div className="flex flex-col gap-4 sm:flex-row">
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

            {canCancel && (
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
                      Are you sure you want to cancel this booking? This action cannot be undone.
                      The calendar event will be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isCancelling}>No, keep it</AlertDialogCancel>
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
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
