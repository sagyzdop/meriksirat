import * as React from 'react'
import { addDays, format } from 'date-fns'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { checkCalendarFreeBusy } from '@/lib/google/google-caledar'
import { createBookingFn } from '@/lib/booking'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CalendarUIProps {
  equipmentId: number
  calendarId: string
}

interface TimeSlot {
  time: string
  available: boolean
}

export function CalendarUI({ equipmentId, calendarId }: CalendarUIProps) {
  const queryClient = useQueryClient()
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [month, setMonth] = React.useState<Date>(new Date())
  const [selectedSlots, setSelectedSlots] = React.useState<string[]>([])
  const [timeSlots, setTimeSlots] = React.useState<TimeSlot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [notes, setNotes] = React.useState('')
  const [isBooking, setIsBooking] = React.useState(false)

  // Generate all possible time slots (24/7, 30-minute increments)
  const generateTimeSlots = (): string[] => {
    const slots: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(
          `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        )
      }
    }
    return slots
  }

  // Check availability for selected date
  const checkAvailability = React.useCallback(
    async (selectedDate: Date) => {
      if (!selectedDate) return

      setIsLoadingSlots(true)
      try {
        // Set time range for the entire day
        const startOfDay = new Date(selectedDate)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(selectedDate)
        endOfDay.setHours(23, 59, 59, 999)

        const result = await checkCalendarFreeBusy({
          data: {
            calendarId,
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
          },
        })

        const busySlots = result.busy || []
        const allSlots = generateTimeSlots()

        // Check each slot against busy periods
        const slotsWithAvailability: TimeSlot[] = allSlots.map((time) => {
          const [hour, minute] = time.split(':').map(Number)
          const slotStart = new Date(selectedDate)
          slotStart.setHours(hour, minute, 0, 0)

          const slotEnd = new Date(slotStart)
          slotEnd.setMinutes(slotEnd.getMinutes() + 30)

          // Check if this slot overlaps with any busy period
          const isAvailable = !busySlots.some(
            (busy: { start: string; end: string }) => {
              const busyStart = new Date(busy.start)
              const busyEnd = new Date(busy.end)
              return (
                (slotStart >= busyStart && slotStart < busyEnd) ||
                (slotEnd > busyStart && slotEnd <= busyEnd) ||
                (slotStart <= busyStart && slotEnd >= busyEnd)
              )
            }
          )

          return { time, available: isAvailable }
        })

        setTimeSlots(slotsWithAvailability)
      } catch (error) {
        console.error('Failed to check availability:', error)
        toast.error('Failed to load availability')
      } finally {
        setIsLoadingSlots(false)
      }
    },
    [calendarId]
  )

  // Load availability when date changes
  React.useEffect(() => {
    if (date) {
      setSelectedSlots([])
      checkAvailability(date)
    }
  }, [date, checkAvailability])

  // Handle time slot selection (allow multiple consecutive slots)
  const handleSlotClick = (time: string) => {
    const slot = timeSlots.find((s) => s.time === time)
    if (!slot?.available) return

    setSelectedSlots((prev) => {
      if (prev.includes(time)) {
        return prev.filter((t) => t !== time)
      } else {
        return [...prev, time].sort()
      }
    })
  }

  // Calculate start and end times from selected slots
  const getBookingTimes = () => {
    if (selectedSlots.length === 0 || !date) return null

    const sortedSlots = [...selectedSlots].sort()
    const firstSlot = sortedSlots[0]
    const lastSlot = sortedSlots[sortedSlots.length - 1]

    const [startHour, startMinute] = firstSlot.split(':').map(Number)
    const [endHour, endMinute] = lastSlot.split(':').map(Number)

    const startTime = new Date(date)
    startTime.setHours(startHour, startMinute, 0, 0)

    const endTime = new Date(date)
    endTime.setHours(endHour, endMinute + 30, 0, 0)

    return { startTime, endTime }
  }

  const handleBooking = async () => {
    const times = getBookingTimes()
    if (!times) return

    setIsBooking(true)
    try {
      const result = await createBookingFn({
        data: {
          equipmentIds: [equipmentId],
          startTime: times.startTime.toISOString(),
          endTime: times.endTime.toISOString(),
          notes: notes || undefined,
        },
      })

      toast.success(
        `Booking created successfully! Booking ID: #${result.bookingId}`
      )
      setIsDialogOpen(false)
      setSelectedSlots([])
      setNotes('')

      // Invalidate bookings query to refresh the bookings list
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })

      // Refresh availability
      if (date) {
        await checkAvailability(date)
      }
    } catch (error: unknown) {
      console.error('Booking failed:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to create booking'
      )
    } finally {
      setIsBooking(false)
    }
  }

  const bookingTimes = getBookingTimes()

  return (
    <>
      <div data-booking-section>
        <Card className="gap-0 p-0">
          <CardContent className="relative p-0 md:pr-64">
            <div className="p-6 flex flex-col items-center gap-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                month={month}
                onMonthChange={setMonth}
                disabled={(date) => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return date < today
                }}
                showOutsideDays={false}
                className="bg-transparent p-0 [--cell-size:--spacing(10)] md:[--cell-size:--spacing(12)]"
                formatters={{
                  formatWeekdayName: (date) => {
                    return date.toLocaleString('en-US', { weekday: 'short' })
                  },
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date()
                    setDate(today)
                    setMonth(today)
                  }}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tomorrow = addDays(new Date(), 1)
                    setDate(tomorrow)
                    setMonth(tomorrow)
                  }}
                >
                  Tomorrow
                </Button>
              </div>
            </div>
            <div className="no-scrollbar inset-y-0 right-0 flex max-h-72 w-full scroll-pb-6 flex-col gap-4 overflow-y-auto border-t p-6 md:absolute md:max-h-none md:w-64 md:border-t-0 md:border-l">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Available Times (30min slots)
              </div>
              {isLoadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="grid gap-1">
                  {timeSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={
                        selectedSlots.includes(slot.time)
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() => handleSlotClick(slot.time)}
                      disabled={!slot.available}
                      className={cn(
                        'w-full shadow-none text-xs h-8',
                        !slot.available && 'opacity-40 cursor-not-allowed'
                      )}
                      size="sm"
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 border-t px-6 !py-5 md:flex-row">
            <div className="text-sm flex-1">
              {bookingTimes ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>
                    Booking for{' '}
                    <span className="font-medium">
                      {date?.toLocaleDateString('en-US', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </span>{' '}
                    from{' '}
                    <span className="font-medium">
                      {format(bookingTimes.startTime, 'HH:mm')}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {format(bookingTimes.endTime, 'HH:mm')}
                    </span>{' '}
                    ({selectedSlots.length} slots)
                  </span>
                </div>
              ) : (
                <span className="text-gray-500">
                  Select one or more consecutive time slots to book this
                  equipment.
                </span>
              )}
            </div>
            <Button
              disabled={selectedSlots.length === 0}
              onClick={() => setIsDialogOpen(true)}
              className="w-full md:ml-auto md:w-auto"
            >
              Book Equipment
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>
              Please provide any additional details for your booking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Booking Details</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Date:</span>{' '}
                  {date?.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                {bookingTimes && (
                  <>
                    <p>
                      <span className="font-medium">Start:</span>{' '}
                      {format(bookingTimes.startTime, 'HH:mm')}
                    </p>
                    <p>
                      <span className="font-medium">End:</span>{' '}
                      {format(bookingTimes.endTime, 'HH:mm')}
                    </p>
                    <p>
                      <span className="font-medium">Duration:</span>{' '}
                      {selectedSlots.length * 30} minutes
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about your booking..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isBooking}
            >
              Cancel
            </Button>
            <Button onClick={handleBooking} disabled={isBooking}>
              {isBooking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Confirm Booking'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
