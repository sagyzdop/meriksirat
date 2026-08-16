import * as React from 'react'
import { ChevronDown, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getClubLocalParts, minutesToTime, timeToMinutes } from '@/lib/booking'
import { cn } from '@/lib/utils'

interface TimeRangePickerProps {
  startTime?: string
  endTime?: string
  defaultStartTime: string
  defaultEndTime: string
  startDate?: string
  operatingHoursStart: number
  operatingHoursEnd: number
  onStartTimeChange: (value?: string) => void
  onEndTimeChange: (value?: string) => void
  className?: string
}

export function TimeRangePicker({
  startTime,
  endTime,
  defaultStartTime,
  defaultEndTime,
  startDate,
  operatingHoursStart,
  operatingHoursEnd,
  onStartTimeChange,
  onEndTimeChange,
  className,
}: TimeRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Every 30-minute slot that can start within the club's operating hours.
  const startSlots = React.useMemo(() => {
    const slots: string[] = []
    for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
      if (minutes >= operatingHoursStart && minutes + 30 <= operatingHoursEnd) {
        slots.push(minutesToTime(minutes))
      }
    }
    return slots
  }, [operatingHoursStart, operatingHoursEnd])

  const { dateKey: todayKey, minutes: nowMinutes } = React.useMemo(
    () => getClubLocalParts(new Date()),
    []
  )

  // Gray out slots whose start has already passed when the filter's start date
  // is today, mirroring the time slot picker so retroactive windows can't be
  // picked.
  const isToday = React.useMemo(
    () => (startDate ?? todayKey) === todayKey,
    [startDate, todayKey]
  )
  const isPast = React.useCallback(
    (time: string) => isToday && timeToMinutes(time) <= nowMinutes,
    [isToday, nowMinutes]
  )

  const explicitlySet = startTime !== undefined
  const shownStartTime = startTime ?? defaultStartTime
  const shownEndTime =
    endTime ??
    (startTime ? minutesToTime(timeToMinutes(startTime) + 30) : defaultEndTime)

  // Slots covered by the current filter range (start inclusive, end exclusive).
  const selectedSlots = React.useMemo(() => {
    if (!explicitlySet) return []
    return startSlots.filter(
      (slot) =>
        slot >= shownStartTime &&
        timeToMinutes(slot) + 30 <= timeToMinutes(shownEndTime)
    )
  }, [explicitlySet, startSlots, shownStartTime, shownEndTime])

  // Behaves like the time slot picker: clicking a slot outside the range
  // extends it to include that slot, clicking an interior slot moves the end
  // of the range up to it, and clicking a boundary slot drops it. The booking
  // window is then first slot -> last slot + 30 minutes.
  const handleSlotClick = (time: string) => {
    if (isPast(time)) return

    // First pick: start a 30-minute range at this slot.
    if (!explicitlySet) {
      onStartTimeChange(time)
      onEndTimeChange(minutesToTime(timeToMinutes(time) + 30))
      return
    }

    const sorted = selectedSlots
    const min = sorted[0]
    const max = sorted[sorted.length - 1]

    if (sorted.includes(time)) {
      // Clicking an interior slot moves the end of the range up to it.
      if (time !== min && time !== max) {
        onStartTimeChange(min)
        onEndTimeChange(minutesToTime(timeToMinutes(time) + 30))
        return
      }
      // Clicking a boundary slot drops it, shrinking the range from that side.
      const next = sorted.filter((slot) => slot !== time)
      if (next.length === 0) {
        onStartTimeChange(undefined)
        onEndTimeChange(undefined)
        return
      }
      onStartTimeChange(next[0])
      onEndTimeChange(minutesToTime(timeToMinutes(next[next.length - 1]) + 30))
      return
    }

    // Clicking a slot outside the range extends the range to include it.
    const next = [...sorted, time].sort()
    onStartTimeChange(next[0])
    onEndTimeChange(minutesToTime(timeToMinutes(next[next.length - 1]) + 30))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Availability time range"
          className={cn(
            'h-8 min-w-20 max-w-full justify-between gap-1.5 border-dashed pl-2.5 pr-1.5',
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Clock
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="tabular-nums">
              {shownStartTime} – {shownEndTime}
            </span>
          </span>
          <ChevronDown
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(calc(100vw-2rem),18rem)] p-2"
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-0.5">
          <span className="text-xs font-medium text-muted-foreground">
            Time range
          </span>
          {explicitlySet && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => {
                onStartTimeChange(undefined)
                onEndTimeChange(undefined)
                setOpen(false)
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="no-scrollbar max-h-72 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 gap-1 p-1 sm:grid-cols-3">
            {startSlots.map((time) => {
              const disabled = isPast(time)
              const isSelected = selectedSlots.includes(time)
              return (
                <Button
                  key={time}
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => handleSlotClick(time)}
                  disabled={disabled}
                  className={cn(
                    'h-8 w-full shadow-none text-xs tabular-nums',
                    disabled && !isSelected && 'cursor-not-allowed opacity-40'
                  )}
                >
                  {time}
                </Button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-1 pt-2">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {explicitlySet
              ? `${shownStartTime} – ${shownEndTime}`
              : 'Pick a start and end time'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-2 text-xs"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
