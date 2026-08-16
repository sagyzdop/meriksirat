import * as React from 'react'
import { addDays, format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import {
  checkCalendarFreeBusy,
  checkMultipleCalendarsFreeBusy,
} from '@/lib/google/google-caledar'
import { bookingsQueries } from '@/lib/booking/queries'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/** Converts "HH:MM" to minutes since midnight. */
function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

interface TimeSlot {
  time: string
  available: boolean
}

interface TimeSlotPickerProps {
  googleCalendarId?: string
  googleCalendarIds?: string[]
  initialDate?: Date
  initialSlots?: string[]
  excludeBookingPeriod?: {
    start: string
    end: string
  }
  onSlotsChange?: (slots: string[], date: Date | undefined) => void
  disabled?: boolean
  layout?: 'horizontal' | 'vertical'
  withCard?: boolean
}

export function TimeSlotPicker({
  googleCalendarId,
  googleCalendarIds,
  initialDate,
  initialSlots = [],
  excludeBookingPeriod,
  onSlotsChange,
  disabled = false,
  layout = 'horizontal',
  withCard = true,
}: TimeSlotPickerProps) {
  const isVerticalLayout = layout === 'vertical'
  const excludeStart = excludeBookingPeriod?.start ?? null
  const excludeEnd = excludeBookingPeriod?.end ?? null
  const { data: bookingSettings } = useQuery(bookingsQueries.settings())
  const operatingHoursStart = bookingSettings?.operatingHoursStart ?? 0
  const operatingHoursEnd = bookingSettings?.operatingHoursEnd ?? 1439
  const [date, setDate] = React.useState<Date | undefined>(initialDate)
  const [month, setMonth] = React.useState<Date | undefined>(initialDate)
  const [selectedSlots, setSelectedSlots] = React.useState<string[]>(
    [...initialSlots].sort()
  )
  const [timeSlots, setTimeSlots] = React.useState<TimeSlot[]>([])
  const isInitialMount = React.useRef(true)

  // Generate all possible time slots (30-minute increments) restricted to the
  // club's operating hours so out-of-hours slots cannot be booked or selected.
  const generateTimeSlots = (): string[] => {
    const slots: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        const slotMinutes = timeToMinutes(time)
        if (
          slotMinutes >= operatingHoursStart &&
          slotMinutes + 30 <= operatingHoursEnd
        ) {
          slots.push(time)
        }
      }
    }
    return slots
  }

  // Drop previously selected slots that fall outside the current operating
  // hours (e.g. hours changed after an existing booking was made).
  React.useEffect(() => {
    setSelectedSlots((prev) =>
      prev.filter((time) => {
        const slotMinutes = timeToMinutes(time)
        return (
          slotMinutes >= operatingHoursStart &&
          slotMinutes + 30 <= operatingHoursEnd
        )
      })
    )
  }, [operatingHoursStart, operatingHoursEnd])

  // Check availability for selected date
  const checkAvailability = React.useCallback(
    async (selectedDate: Date) => {
      const resolvedCalendarIds =
        googleCalendarIds && googleCalendarIds.length > 0
          ? googleCalendarIds
          : googleCalendarId
            ? [googleCalendarId]
            : []

      if (!selectedDate || resolvedCalendarIds.length === 0) {
        setTimeSlots([])
        return
      }

      try {
        const startOfDay = new Date(selectedDate)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(selectedDate)
        endOfDay.setHours(23, 59, 59, 999)

        let busySlots: Array<{ start: string; end: string }> = []
        if (resolvedCalendarIds.length === 1) {
          const result = await checkCalendarFreeBusy({
            data: {
              calendarId: resolvedCalendarIds[0],
              timeMin: startOfDay.toISOString(),
              timeMax: endOfDay.toISOString(),
            },
          })
          busySlots = result.busy || []
        } else {
          const result = await checkMultipleCalendarsFreeBusy({
            data: {
              equipmentCalendarIds: resolvedCalendarIds,
              timeMin: startOfDay.toISOString(),
              timeMax: endOfDay.toISOString(),
            },
          })
          busySlots = resolvedCalendarIds.flatMap(
            (calendarId) => result[calendarId]?.busy || []
          )
        }
        const allSlots = generateTimeSlots()

        // Slots whose start time has already passed cannot be booked. This
        // prevents retroactive bookings when today is selected.
        const now = Date.now()
        const pastSlotTimes = new Set(
          allSlots.filter((time) => {
            const [hour, minute] = time.split(':').map(Number)
            const slotStart = new Date(selectedDate)
            slotStart.setHours(hour, minute, 0, 0)
            return slotStart.getTime() <= now
          })
        )

        // Check each slot against busy periods
        const slotsWithAvailability: TimeSlot[] = allSlots.map((time) => {
          const [hour, minute] = time.split(':').map(Number)
          const slotStart = new Date(selectedDate)
          slotStart.setHours(hour, minute, 0, 0)

          const slotEnd = new Date(slotStart)
          slotEnd.setMinutes(slotEnd.getMinutes() + 30)

          const isPast = pastSlotTimes.has(time)

          // Check if this slot overlaps with any busy period
          const isAvailable =
            !isPast &&
            !busySlots.some((busy: any) => {
              const busyStart = new Date(busy.start)
              const busyEnd = new Date(busy.end)

              // Skip the excluded booking period if provided
              if (excludeStart && excludeEnd) {
                const excludeStartDate = new Date(excludeStart)
                const excludeEndDate = new Date(excludeEnd)
                if (
                  busyStart.getTime() === excludeStartDate.getTime() &&
                  busyEnd.getTime() === excludeEndDate.getTime()
                ) {
                  return false
                }
              }

              return (
                (slotStart >= busyStart && slotStart < busyEnd) ||
                (slotEnd > busyStart && slotEnd <= busyEnd) ||
                (slotStart <= busyStart && slotEnd >= busyEnd)
              )
            })

          return { time, available: isAvailable }
        })

        setTimeSlots(slotsWithAvailability)

        // Drop any previously selected slots that are now in the past (e.g. an
        // existing booking edited during its start window), so the derived
        // booking times can never start in the past.
        setSelectedSlots((prev) => prev.filter((t) => !pastSlotTimes.has(t)))
      } catch (error) {
        console.error('Failed to check availability:', error)
        toast.error('Failed to load availability')
      }
    },
    [
      googleCalendarId,
      googleCalendarIds,
      excludeStart,
      excludeEnd,
      operatingHoursStart,
      operatingHoursEnd,
    ]
  )

  // Load availability when date changes
  React.useEffect(() => {
    if (date) {
      checkAvailability(date)
    }
  }, [date, checkAvailability])

  React.useEffect(() => {
    if (!date) {
      const today = new Date()
      setDate(today)
      setMonth(today)
    } else if (!month) {
      setMonth(date)
    }
  }, [date, month])

  // Notify parent of changes
  React.useEffect(() => {
    if (onSlotsChange) {
      onSlotsChange(selectedSlots, date)
    }
  }, [selectedSlots, date, onSlotsChange])

  // Handle date change
  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate)
    // Only clear selected slots when date changes after initial mount
    if (!isInitialMount.current) {
      setSelectedSlots([])
    }
  }

  // Mark that initial mount is complete after first render
  React.useEffect(() => {
    isInitialMount.current = false
  }, [])

  // Fill the contiguous range of slots between `from` and `to` (inclusive).
  const fillRange = (from: string, to: string) =>
    timeSlots
      .map((s) => s.time)
      .sort()
      .filter((t) => t >= from && t <= to)

  // Handle time slot selection. Selections are treated as a range: picking any
  // set of slots selects every slot between the earliest and latest pick, which
  // is also how the booking times are derived (first slot → last slot + 30min).
  // Clicking an already-selected slot inside the range moves the end of the
  // range up to that slot; clicking a boundary slot drops it.
  const handleSlotClick = (time: string) => {
    if (disabled) return

    const slot = timeSlots.find((s) => s.time === time)
    if (!slot?.available) return

    setSelectedSlots((prev) => {
      if (prev.length === 0) return [time]

      const sorted = [...prev].sort()
      const min = sorted[0]
      const max = sorted[sorted.length - 1]

      if (prev.includes(time)) {
        // Clicking an interior slot moves the end of the range up to it.
        if (time !== min && time !== max) return fillRange(min, time)
        // Clicking a boundary slot drops it, shrinking the range from that side.
        const next = prev.filter((t) => t !== time)
        if (next.length === 0) return next
        const nextSorted = [...next].sort()
        return fillRange(nextSorted[0], nextSorted[nextSorted.length - 1])
      }

      // Clicking a slot outside the range extends the range to include it.
      return fillRange(time < min ? time : min, time > max ? time : max)
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

  const bookingTimes = getBookingTimes()

  const content = (
    <>
      <div className={cn('relative min-w-0', !isVerticalLayout && 'md:pr-64')}>
        <div className="p-6 flex w-full min-w-0 flex-col items-center gap-4">
          <div className="w-full overflow-x-auto">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateChange}
              month={month}
              onMonthChange={setMonth}
              disabled={(date) => {
                if (disabled) return true
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return date < today
              }}
              showOutsideDays={false}
              className="mx-auto w-fit max-w-full bg-transparent p-0 [--cell-size:--spacing(8)] sm:[--cell-size:--spacing(9)] md:[--cell-size:--spacing(12)]"
              formatters={{
                formatWeekdayName: (date) => {
                  return date.toLocaleString('en-US', { weekday: 'short' })
                },
              }}
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
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
              disabled={disabled}
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
        <div
          className={cn(
            'no-scrollbar flex max-h-72 w-full scroll-pb-6 flex-col gap-4 overflow-y-auto border-t p-6',
            !isVerticalLayout &&
              'inset-y-0 right-0 md:absolute md:max-h-none md:w-64 md:border-t-0 md:border-l',
            isVerticalLayout && 'md:static md:max-h-72 md:w-full'
          )}
        >
          <div className="text-sm font-medium text-gray-700 mb-2">
            Available Times (30min slots)
          </div>
          <div className="grid gap-1">
            {timeSlots.map((slot) => (
              <Button
                key={slot.time}
                variant={
                  selectedSlots.includes(slot.time) ? 'default' : 'outline'
                }
                onClick={() => handleSlotClick(slot.time)}
                disabled={!slot.available || disabled}
                className={cn(
                  'w-full shadow-none text-xs h-8',
                  !slot.available &&
                    !selectedSlots.includes(slot.time) &&
                    'opacity-40 cursor-not-allowed'
                )}
                size="sm"
              >
                {slot.time}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t px-6 py-5! md:flex-row">
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
                ({selectedSlots.length} slot
                {selectedSlots.length !== 1 ? 's' : ''})
              </span>
            </div>
          ) : (
            <span className="text-gray-500">
              Select one or more time slots to book this equipment.
            </span>
          )}
        </div>
      </div>
    </>
  )

  if (!withCard) {
    return <div className="rounded-lg border bg-card">{content}</div>
  }

  return (
    <Card className="gap-0 p-0">
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  )
}

export function getBookingTimesFromSlots(
  slots: string[],
  date: Date | undefined
) {
  if (slots.length === 0 || !date) return null

  const sortedSlots = [...slots].sort()
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
