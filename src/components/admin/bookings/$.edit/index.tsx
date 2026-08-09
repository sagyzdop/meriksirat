import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { updateBookingStatusAdminFn } from '@/lib/booking'
import { getBookingSlots } from '@/lib/booking/slots'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Save, Calendar, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { format } from 'date-fns'
import { getBookingTimesFromSlots } from '@/components/shared/time-slot-picker'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { BookingEquipmentTable } from '@/components/shared/booking-equipment-table'
import { BookingSchedule } from '@/components/shared/booking-schedule'
import type { AdminBookingWithDetails } from '@/lib/booking/types'

const editBookingSchema = z.object({
  status: z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue']),
  notes: z.string().optional(),
})

type EditBookingForm = z.infer<typeof editBookingSchema>

interface PageProps {
  booking: AdminBookingWithDetails
  bookingId: number
}

export function Page({ booking, bookingId }: PageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const initialSlots = getBookingSlots(booking.startTime, booking.endTime)
  const [selectedSlots, setSelectedSlots] = useState<string[]>(initialSlots)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(booking.startTime))

  const form = useForm<EditBookingForm>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      status: booking.status as 'booked' | 'active' | 'returned' | 'cancelled' | 'overdue',
      notes: '',
    },
  })

  const canEditSchedule = booking.status === 'booked' || booking.status === 'active'
  const items = booking.items ?? []
  const hasCalendar = items.some((item) => item.equipment?.googleCalendarId)

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

  const isOverdue = new Date(booking.endTime) < new Date() &&
    (booking.status === 'booked' || booking.status === 'active' || booking.status === 'partially_returned')

  return (
    <PageContainer>
      <PageHeader
        title="Edit Booking"
        backTo="/admin/bookings"
        backLabel="Back to Bookings"
      />

      <div className="space-y-8">
        {isOverdue && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This booking is overdue! The equipment was due on {format(new Date(booking.endTime), 'PPP p')}.
            </AlertDescription>
          </Alert>
        )}

        <Section
          title="Details"
          description="Administrative context for this booking"
          spacing="compact"
        >
          <div className="relative rounded-md border overflow-x-auto">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">ID</TableCell>
                  <TableCell className="whitespace-nowrap">{booking.id}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Status</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Select
                      onValueChange={(value) => form.setValue('status', value as EditBookingForm['status'])}
                      value={form.watch('status')}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Start Time</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(booking.startTime), 'EEE, MMM d, yyyy HH:mm')}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">End Time</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(booking.endTime), 'EEE, MMM d, yyyy HH:mm')}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Created At</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(booking.createdAt), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Section>

        <Section
          title="User Info"
          description="The user who booked this equipment"
          spacing="compact"
        >
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <span className="font-medium">User Name:</span>
              <p className="mt-1 text-muted-foreground">
                {`${booking.user?.firstName || ''} ${booking.user?.lastName || ''}`.trim() || 'Unknown'}
              </p>
            </div>
            <div>
              <span className="font-medium">User Email:</span>
              <p className="mt-1 break-all text-muted-foreground">
                {booking.user?.email || 'Unknown'}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Equipment Details" spacing="compact">
          {items.length > 0 ? (
            <BookingEquipmentTable items={items} />
          ) : (
            <div className="relative rounded-md border py-12 text-center text-muted-foreground">
              Equipment details not available
            </div>
          )}
        </Section>

        {/* Availability / Update Date & Time */}
        <BookingSchedule
          items={items}
          startTime={booking.startTime}
          endTime={booking.endTime}
          canEdit={canEditSchedule}
          warnWhenLocked
          initialSlots={initialSlots}
          disabled={isSubmitting}
          onSlotsChange={(slots, date) => {
            setSelectedSlots(slots)
            setSelectedDate(date)
          }}
        />

        <Section
          title="Admin Status & Notes"
          description="Change the booking status, add administrative notes, and optionally update the schedule."
          spacing="compact"
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

              <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Cancel
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
        </Section>
      </div>
    </PageContainer>
  )
}
