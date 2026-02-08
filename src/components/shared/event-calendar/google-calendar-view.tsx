import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import { getCalendarEvents } from "@/lib/google/google-caledar"
import {
  EventCalendar,
  type CalendarEvent,
  type CalendarView,
  type EventColor,
} from "@/components/shared/event-calendar"

interface GoogleCalendarViewProps {
  calendarId: string
  className?: string
}

type CalendarRange = {
  start: Date
  end: Date
  view: CalendarView
}

const colorMap: Record<string, EventColor> = {
  "1": "sky",
  "2": "emerald",
  "3": "violet",
  "4": "rose",
  "5": "amber",
  "6": "orange",
  "7": "sky",
  "8": "emerald",
  "9": "violet",
  "10": "rose",
  "11": "amber",
}

const toCalendarEvent = (event: any): CalendarEvent | null => {
  if (!event || event.status === "cancelled") return null

  const startValue = event.start?.dateTime ?? event.start?.date
  const endValue = event.end?.dateTime ?? event.end?.date
  if (!startValue || !endValue) return null

  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime)
  const startDate = new Date(startValue)
  const rawEnd = new Date(endValue)
  const endDate = isAllDay ? new Date(rawEnd.getTime() - 1) : rawEnd

  return {
    id: event.id || `${startDate.getTime()}`,
    title: event.summary || "(no title)",
    description: event.description || "",
    location: event.location || "",
    start: startDate,
    end: endDate,
    allDay: isAllDay,
    color: colorMap[event.colorId] || "sky",
  }
}

export function GoogleCalendarView({
  calendarId,
  className,
}: GoogleCalendarViewProps) {
  const [range, setRange] = useState<CalendarRange | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleRangeChange = useCallback((nextRange: CalendarRange) => {
    setRange((prev) => {
      if (!prev) return nextRange

      const sameView = prev.view === nextRange.view
      const sameStart = prev.start.getTime() === nextRange.start.getTime()
      const sameEnd = prev.end.getTime() === nextRange.end.getTime()

      return sameView && sameStart && sameEnd ? prev : nextRange
    })
  }, [])

  useEffect(() => {
    if (!calendarId || !range) return

    let cancelled = false

    const loadEvents = async () => {
      setIsLoading(true)
      try {
        const items = await getCalendarEvents({
          data: {
            equipmentCalendarId: calendarId,
            timeMin: range.start.toISOString(),
            timeMax: range.end.toISOString(),
          },
        })

        if (cancelled) return

        const mapped = (items || [])
          .map(toCalendarEvent)
          .filter((item): item is CalendarEvent => Boolean(item))

        setEvents(mapped)
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load calendar events:", error)
          toast.error("Failed to load calendar events")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadEvents()

    return () => {
      cancelled = true
    }
  }, [calendarId, range])

  if (isLoading && events.length === 0) {
    return (
      <div
        className={cn(
          "flex h-150 w-full items-center justify-center overflow-hidden rounded-lg border bg-muted",
          className
        )}
      >
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className={cn("h-150 overflow-hidden", className)}>
      <EventCalendar
        events={events}
        initialView="week"
        availableViews={["week", "month"]}
        readOnly
        weekCellsHeight={32}
        onRangeChange={handleRangeChange}
        containerClassName="h-full overflow-hidden"
      />
    </div>
  )
}
