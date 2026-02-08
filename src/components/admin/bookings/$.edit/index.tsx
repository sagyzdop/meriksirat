import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemo, useState } from 'react'
import { updateBookingStatusAdminFn } from '@/lib/booking'
import { GoogleCalendarView } from '@/components/shared/event-calendar/google-calendar-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, Calendar, User, AlertCircle, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { format } from 'date-fns'
import { TimeSlotPicker, getBookingTimesFromSlots } from '@/components/shared/time-slot-picker'

const editBookingSchema = z.object({
  status: z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue']),
  notes: z.string().optional(),
})

type EditBookingForm = z.infer<typeof editBookingSchema>

interface PageProps {
  booking: any
  bookingId: number
}

export function Page({ booking, bookingId }: PageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const getInitialSlots = () => {
    const startTime = new Date(booking.startTime)
    const endTime = new Date(booking.endTime)

    const slots: string[] = []
    const current = new Date(startTime)

    while (current < endTime) {
      const timeStr = `${current.getHours().toString().padStart(2, '0')}:${current
        .getMinutes()
        .toString()
        .padStart(2, '0')}`
      slots.push(timeStr)
      current.setMinutes(current.getMinutes() + 30)
    }

    return slots
  }

  const initialSlots = useMemo(() => getInitialSlots(), [booking.startTime, booking.endTime])
  const [selectedSlots, setSelectedSlots] = useState<string[]>(initialSlots)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(booking.startTime))


  const form = useForm<EditBookingForm>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      status: booking.status as 'booked' | 'active' | 'returned' | 'cancelled' | 'overdue',
      notes: '',
    },
  })

  const onSubmit = async (data: EditBookingForm) => {
    const times = canEditSchedule && hasCalendar
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
        status: EditBookingForm['status']
        notes?: string
        startTime?: string
        endTime?: string
      } = {
        bookingId,
        status: data.status,
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

      setSuccess('Booking updated successfully! Database and calendar have been synchronized.')

      setTimeout(() => {
        navigate({ to: '/admin/bookings' })
      }, 2000)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/admin/bookings' })
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
      default:
        return 'secondary'
    }
  }

  const isOverdue = new Date(booking.endTime) < new Date() &&
    (booking.status === 'booked' || booking.status === 'active')

  const canEditSchedule = booking.status === 'booked' || booking.status === 'active'
  const hasCalendar = Boolean(booking.equipment?.googleCalendarId)

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
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
          <Badge variant={getStatusBadgeVariant(booking.status)}>
            {booking.status.toUpperCase()}
          </Badge>
        </div>

        {isOverdue && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This booking is overdue! The equipment was due on {format(new Date(booking.endTime), 'PPP p')}.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User & Booking Info
            </CardTitle>
            <CardDescription>Administrative context for this booking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">User Name:</span>
                <p className="text-muted-foreground mt-1">
                  {`${booking.user?.firstName || ''} ${booking.user?.lastName || ''}`.trim() || 'Unknown'}
                </p>
              </div>
              <div>
                <span className="font-medium">User Email:</span>
                <p className="text-muted-foreground mt-1 break-all">
                  {booking.user?.email || 'Unknown'}
                </p>
              </div>
              <div>
                <span className="font-medium">Equipment ID:</span>
                <p className="text-muted-foreground mt-1 font-mono">{booking.equipmentId}</p>
              </div>
              <div>
                <span className="font-medium">Calendar Event ID:</span>
                <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
                  {booking.googleCalendarEventId || 'Not synced'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Equipment Details</h2>
            <Badge variant={getStatusBadgeVariant(booking.status)}>
              {booking.status.toUpperCase()}
            </Badge>
          </div>

          <Link
            to="/admin/equipment/$equipmentId/edit"
            params={{ equipmentId: booking.equipmentId.toString() }}
            className="block"
          >
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  <div className="relative flex-shrink-0">
                    {booking.equipment?.imagePath ? (
                      <img
                        src={`/api/images/${booking.equipment.imagePath}`}
                        alt={booking.equipment.modelName}
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
                        <h3 className="text-lg font-semibold mb-1">
                          {booking.equipment?.modelName || 'Unknown Equipment'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {booking.equipment?.category?.name || 'Uncategorized'}
                        </p>
                        {booking.equipment?.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {booking.equipment.description}
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
        </div>

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
              <span className="font-medium text-sm">User Notes & History:</span>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {booking.userEventDetails}
              </p>
            </div>
          )}
        </div>

        {hasCalendar && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Availability</h2>
            <GoogleCalendarView calendarId={booking.equipment.googleCalendarId} />
          </div>
        )}

        {hasCalendar && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Update Date & Time</h2>
            {!canEditSchedule && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="pt-6">
                  <p className="text-sm text-yellow-800">
                    Schedule updates are only available for <strong>booked</strong> or <strong>active</strong> bookings.
                  </p>
                </CardContent>
              </Card>
            )}
            {canEditSchedule && (
              <TimeSlotPicker
                googleCalendarId={booking.equipment!.googleCalendarId}
                initialDate={new Date(booking.startTime)}
                initialSlots={initialSlots}
                excludeBookingPeriod={{
                  start: booking.startTime,
                  end: booking.endTime,
                }}
                onSlotsChange={(slots, date) => {
                  setSelectedSlots(slots)
                  setSelectedDate(date)
                }}
                disabled={isSubmitting}
              />
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Admin Status & Notes</CardTitle>
            <CardDescription>
              Change the booking status, add administrative notes, and optionally update the schedule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Booking Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="booked">Booked</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="returned">Returned</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {field.value === 'cancelled' &&
                          'Cancelling will delete the Google Calendar event.'}
                        {field.value === 'returned' &&
                          'Mark as returned when equipment has been returned.'}
                        {field.value === 'overdue' &&
                          'Mark as overdue when equipment is not returned on time.'}
                        {field.value === 'active' &&
                          'Mark as active when equipment has been picked up.'}
                        {field.value === 'booked' &&
                          'Booked status indicates the booking is confirmed but equipment not yet picked up.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                        These notes will be appended to the booking history and visible to other admins.
                        Your email will be automatically included with the note.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Calendar Synchronization:</strong> Updates will be synchronized with Google Calendar,
                    including status changes, schedule updates, and administrative notes.
                  </AlertDescription>
                </Alert>

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

                <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Save className="h-4 w-4" />
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
