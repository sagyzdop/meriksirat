import * as React from "react"
import { addDays, format } from "date-fns"
import { CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { checkCalendarFreeBusy, checkMultipleCalendarsFreeBusy } from "@/lib/google/google-caledar"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
  layout?: "horizontal" | "vertical"
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
  layout = "horizontal",
  withCard = true,
}: TimeSlotPickerProps) {
  const isVerticalLayout = layout === "vertical"
  const excludeStart = excludeBookingPeriod?.start ?? null
  const excludeEnd = excludeBookingPeriod?.end ?? null
  const [date, setDate] = React.useState<Date | undefined>(initialDate)
  const [month, setMonth] = React.useState<Date | undefined>(initialDate)
  const [selectedSlots, setSelectedSlots] = React.useState<string[]>(initialSlots)
  const [timeSlots, setTimeSlots] = React.useState<TimeSlot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = React.useState(false)
  const isInitialMount = React.useRef(true)

  // Generate all possible time slots (24/7, 30-minute increments)
  const generateTimeSlots = (): string[] => {
    const slots: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`)
      }
    }
    return slots
  }

  // Check availability for selected date
  const checkAvailability = React.useCallback(
    async (selectedDate: Date) => {
      const resolvedCalendarIds = (googleCalendarIds && googleCalendarIds.length > 0)
        ? googleCalendarIds
        : (googleCalendarId ? [googleCalendarId] : [])

      if (!selectedDate || resolvedCalendarIds.length === 0) {
        setTimeSlots([])
        return
      }

      setIsLoadingSlots(true)
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
          busySlots = resolvedCalendarIds.flatMap((calendarId) => result[calendarId]?.busy || [])
        }
        const allSlots = generateTimeSlots()

        // Check each slot against busy periods
        const slotsWithAvailability: TimeSlot[] = allSlots.map((time) => {
          const [hour, minute] = time.split(":").map(Number)
          const slotStart = new Date(selectedDate)
          slotStart.setHours(hour, minute, 0, 0)

          const slotEnd = new Date(slotStart)
          slotEnd.setMinutes(slotEnd.getMinutes() + 30)

          // Check if this slot overlaps with any busy period
          const isAvailable = !busySlots.some((busy: any) => {
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
      } catch (error) {
        console.error("Failed to check availability:", error)
        toast.error("Failed to load availability")
      } finally {
        setIsLoadingSlots(false)
      }
    },
    [googleCalendarId, googleCalendarIds, excludeStart, excludeEnd]
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

  // Handle time slot selection
  const handleSlotClick = (time: string) => {
    if (disabled) return
    
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

    const [startHour, startMinute] = firstSlot.split(":").map(Number)
    const [endHour, endMinute] = lastSlot.split(":").map(Number)

    const startTime = new Date(date)
    startTime.setHours(startHour, startMinute, 0, 0)

    const endTime = new Date(date)
    endTime.setHours(endHour, endMinute + 30, 0, 0)

    return { startTime, endTime }
  }

  const bookingTimes = getBookingTimes()

  const content = (
    <>
      <div className={cn("relative", !isVerticalLayout && "md:pr-64")}>
        <div className="p-6 flex flex-col items-center gap-4">
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
            className="bg-transparent p-0 [--cell-size:--spacing(10)] md:[--cell-size:--spacing(12)]"
            formatters={{
              formatWeekdayName: (date) => {
                return date.toLocaleString("en-US", { weekday: "short" })
              },
            }}
          />
          <div className="flex gap-2">
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
            "no-scrollbar flex max-h-72 w-full scroll-pb-6 flex-col gap-4 overflow-y-auto border-t p-6",
            !isVerticalLayout && "inset-y-0 right-0 md:absolute md:max-h-none md:w-64 md:border-t-0 md:border-l",
            isVerticalLayout && "md:static md:max-h-72 md:w-full"
          )}
        >
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
                  variant={selectedSlots.includes(slot.time) ? "default" : "outline"}
                  onClick={() => handleSlotClick(slot.time)}
                  disabled={!slot.available || disabled}
                  className={cn(
                    "w-full shadow-none text-xs h-8",
                    !slot.available && "opacity-40 cursor-not-allowed"
                  )}
                  size="sm"
                >
                  {slot.time}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t px-6 py-5! md:flex-row">
        <div className="text-sm flex-1">
          {bookingTimes ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>
                Booking for{" "}
                <span className="font-medium">
                  {date?.toLocaleDateString("en-US", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
                {" "}from <span className="font-medium">{format(bookingTimes.startTime, "HH:mm")}</span>
                {" "}to <span className="font-medium">{format(bookingTimes.endTime, "HH:mm")}</span>
                {" "}({selectedSlots.length} slot{selectedSlots.length !== 1 ? 's' : ''})
              </span>
            </div>
          ) : (
            <span className="text-gray-500">
              Select one or more consecutive time slots to book this equipment.
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

export function getBookingTimesFromSlots(slots: string[], date: Date | undefined) {
  if (slots.length === 0 || !date) return null

  const sortedSlots = [...slots].sort()
  const firstSlot = sortedSlots[0]
  const lastSlot = sortedSlots[sortedSlots.length - 1]

  const [startHour, startMinute] = firstSlot.split(":").map(Number)
  const [endHour, endMinute] = lastSlot.split(":").map(Number)

  const startTime = new Date(date)
  startTime.setHours(startHour, startMinute, 0, 0)

  const endTime = new Date(date)
  endTime.setHours(endHour, endMinute + 30, 0, 0)

  return { startTime, endTime }
}
