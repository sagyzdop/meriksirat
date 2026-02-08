import { memo, useCallback, useEffect, useMemo, useState } from "react"
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
  calendarId?: string
  calendarIds?: string[]
  colorByCalendarId?: Record<string, EventColor>
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

const toCalendarEvent = (event: any, colorOverride?: EventColor): CalendarEvent | null => {
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
    color: colorOverride || colorMap[event.colorId] || "sky",
  }
}

function GoogleCalendarViewBase({
  calendarId,
  calendarIds,
  colorByCalendarId,
  className,
}: GoogleCalendarViewProps) {
  const [range, setRange] = useState<CalendarRange | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const calendarIdList = useMemo(() => {
    if (calendarIds && calendarIds.length > 0) return calendarIds
    return calendarId ? [calendarId] : []
  }, [calendarId, calendarIds])

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
    if (calendarIdList.length === 0 || !range) return

    let cancelled = false

    const loadEvents = async () => {
      setIsLoading(true)
      try {
        const results = await Promise.all(
          calendarIdList.map(async (id) => {
            const items = await getCalendarEvents({
              data: {
                equipmentCalendarId: id,
                timeMin: range.start.toISOString(),
                timeMax: range.end.toISOString(),
              },
            })
            const overrideColor = colorByCalendarId?.[id]
            return (items || [])
              .map((item) => toCalendarEvent(item, overrideColor))
              .filter((item): item is CalendarEvent => Boolean(item))
          })
        )

        if (cancelled) return

        setEvents(results.flat())
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
  }, [calendarIdList, colorByCalendarId, range])

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

const areEqualProps = (prev: GoogleCalendarViewProps, next: GoogleCalendarViewProps) => {
  if (prev.className !== next.className) return false
  if (prev.calendarId !== next.calendarId) return false

  const prevIds = prev.calendarIds
  const nextIds = next.calendarIds
  if ((prevIds?.length ?? 0) !== (nextIds?.length ?? 0)) return false
  if (prevIds && nextIds) {
    for (let i = 0; i < prevIds.length; i += 1) {
      if (prevIds[i] !== nextIds[i]) return false
    }
  }

  const prevColors = prev.colorByCalendarId
  const nextColors = next.colorByCalendarId
  if (!prevColors && !nextColors) return true
  if (!prevColors || !nextColors) return false

  const prevKeys = Object.keys(prevColors)
  const nextKeys = Object.keys(nextColors)
  if (prevKeys.length !== nextKeys.length) return false
  for (const key of prevKeys) {
    if (prevColors[key] !== nextColors[key]) return false
  }

  return true
}

export const GoogleCalendarView = memo(GoogleCalendarViewBase, areEqualProps)
