import { useNavigate, Link } from '@tanstack/react-router'
import * as React from 'react'
import { updateBookingFn, cancelBookingFn } from '@/lib/booking'
import { GoogleCalendarView } from '@/components/shared/event-calendar/google-calendar-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, ExternalLink, Trash2 } from 'lucide-react'
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
import { TimeSlotPicker, getBookingTimesFromSlots } from '@/components/shared/time-slot-picker'

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

  // Calculate initial slots from booking times
  const getInitialSlots = () => {
    const startTime = new Date(booking.startTime)
    const endTime = new Date(booking.endTime)
    
    const slots: string[] = []
    const current = new Date(startTime)
    
    while (current < endTime) {
      const timeStr = `${current.getHours().toString().padStart(2, "0")}:${current.getMinutes().toString().padStart(2, "0")}`
      slots.push(timeStr)
      current.setMinutes(current.getMinutes() + 30)
    }
    
    return slots
  }

  const initialSlots = React.useMemo(() => getInitialSlots(), [booking.startTime, booking.endTime])


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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'booked':
        return 'secondary'
      case 'returned':
        return 'outline'
      case 'cancelled':
        return 'destructive'
      case 'overdue':
        return 'destructive'
      case 'partially_returned':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const itemCalendarIds = booking.items
    ?.map((item: any) => item.equipment?.googleCalendarId)
    .filter((id: string | undefined): id is string => Boolean(id)) ?? []

  const canEdit = booking.status === 'booked' || booking.status === 'active'
  const canCancel = booking.status !== 'cancelled' && booking.status !== 'returned'

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Booking</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Booking ID: #{booking.id} • Created {format(new Date(booking.createdAt), 'PPP')}
            </p>
          </div>
        </div>

        {/* Booking Status */}
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Equipment Details</h2>
            <Badge variant={getStatusBadgeVariant(booking.status)}>
              {booking.status.toUpperCase()}
            </Badge>
          </div>
          
          {booking.items?.map((item: any) => (
            <Link key={item.id} to="/equipment/$" params={{ _splat: item.equipmentId.toString() }} className="block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary/50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    <div className="relative flex-shrink-0">
                      {item.equipment?.imagePath ? (
                        <img 
                          src={`/api/images/${item.equipment.imagePath}`} 
                          alt={item.equipment.modelName}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                          <span className="text-muted-foreground text-xs">No image</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1">{item.equipment?.modelName || 'Unknown Equipment'}</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {item.equipment?.category?.name || 'Uncategorized'}
                          </p>
                          {item.equipment?.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.equipment.description}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Current Booking Details */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Current Booking</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Start Time:</span>
              <p className="text-muted-foreground mt-1">
                {format(new Date(booking.startTime), 'PPP p')}
              </p>
            </div>
            <div>
              <span className="font-medium">End Time:</span>
              <p className="text-muted-foreground mt-1">
                {format(new Date(booking.endTime), 'PPP p')}
              </p>
            </div>
          </div>
          {booking.userEventDetails && (
            <div className="mt-4 pt-4 border-t">
              <span className="font-medium text-sm">Current Notes:</span>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {booking.userEventDetails}
              </p>
            </div>
          )}
        </div>

        {/* Availability */}
        {itemCalendarIds.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Availability</h2>
            <GoogleCalendarView calendarId={itemCalendarIds[0]} />
          </div>
        )}

        {/* Date & Time Selection */}
        {canEdit && itemCalendarIds.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Update Date & Time</h2>
            <TimeSlotPicker
              googleCalendarIds={itemCalendarIds}
              initialDate={new Date(booking.startTime)}
              initialSlots={initialSlots}
              excludeBookingPeriod={{
                start: booking.startTime,
                end: booking.endTime,
              }}
              onSlotsChange={handleSlotsChange}
              disabled={isSubmitting}
            />
          </div>
        )}

        {/* Notes Section */}
        {canEdit && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Update Notes</h2>
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
          </div>
        )}

        {/* Action Buttons */}
        {canEdit && (
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
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
                    className="flex items-center gap-2 w-full sm:w-auto"
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
    </div>
  )
}
