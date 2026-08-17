import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { getCalendarEvents } from '@/lib/google/google-caledar'
import {
  EventCalendar,
  type CalendarEvent,
  type CalendarView,
  type EventColor,
} from '@/components/shared/event-calendar'

interface GoogleCalendarViewProps {
  calendarId?: string
  calendarIds?: string[]
  colorByCalendarId?: Record<string, EventColor>
  legendLabels?: Record<string, string>
  className?: string
}

type CalendarRange = {
  start: Date
  end: Date
  view: CalendarView
}

const colorMap: Record<string, EventColor> = {
  '1': 'sky',
  '2': 'emerald',
  '3': 'violet',
  '4': 'rose',
  '5': 'amber',
  '6': 'orange',
  '7': 'sky',
  '8': 'emerald',
  '9': 'violet',
  '10': 'rose',
  '11': 'amber',
}

const DOT_CLASSES: Record<EventColor, string> = {
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  emerald: 'bg-emerald-500',
  orange: 'bg-orange-500',
}

const LEGEND_PALETTE: EventColor[] = [
  'sky',
  'emerald',
  'violet',
  'rose',
  'amber',
  'orange',
]

const toCalendarEvent = (
  event: {
    id?: string
    summary?: string
    description?: string
    location?: string
    status?: string
    colorId?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
  },
  colorOverride?: EventColor
): CalendarEvent | null => {
  if (!event || event.status === 'cancelled') return null

  const startValue = event.start?.dateTime ?? event.start?.date
  const endValue = event.end?.dateTime ?? event.end?.date
  if (!startValue || !endValue) return null

  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime)
  const startDate = new Date(startValue)
  const rawEnd = new Date(endValue)
  const endDate = isAllDay ? new Date(rawEnd.getTime() - 1) : rawEnd

  return {
    id: event.id || `${startDate.getTime()}`,
    title: event.summary || '(no title)',
    description: event.description || '',
    location: event.location || '',
    start: startDate,
    end: endDate,
    allDay: isAllDay,
    color:
      colorOverride ||
      (event.colorId ? colorMap[event.colorId] : undefined) ||
      'sky',
  }
}

function GoogleCalendarViewBase({
  calendarId,
  calendarIds,
  colorByCalendarId,
  legendLabels,
  className,
}: GoogleCalendarViewProps) {
  const [range, setRange] = useState<CalendarRange | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const calendarIdList = useMemo(() => {
    if (calendarIds && calendarIds.length > 0) return calendarIds
    return calendarId ? [calendarId] : []
  }, [calendarId, calendarIds])

  const legendItems = useMemo(
    () =>
      calendarIdList.map((id, index) => ({
        calendarId: id,
        label: legendLabels?.[id] ?? id,
        color:
          colorByCalendarId?.[id] ??
          LEGEND_PALETTE[index % LEGEND_PALETTE.length],
      })),
    [calendarIdList, colorByCalendarId, legendLabels]
  )

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
          console.error('Failed to load calendar events:', error)
          toast.error('Failed to load calendar events')
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

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative h-150 overflow-hidden">
        {isLoading && events.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
            <Spinner className="h-8 w-8" />
          </div>
        )}
        <EventCalendar
          events={events}
          initialView="week"
          availableViews={['week', 'month']}
          readOnly
          weekCellsHeight={32}
          onRangeChange={handleRangeChange}
          containerClassName="h-full overflow-hidden"
        />
      </div>
      {legendItems.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {legendItems.map((item) => (
            <div key={item.calendarId} className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex size-2.5 shrink-0 rounded-full',
                  DOT_CLASSES[item.color]
                )}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const areEqualProps = (
  prev: GoogleCalendarViewProps,
  next: GoogleCalendarViewProps
) => {
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

  const recordsEqual = <T extends Record<string, string>>(
    a?: T,
    b?: T
  ): boolean => {
    if (!a && !b) return true
    if (!a || !b) return false
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((key) => a[key] === b[key])
  }

  if (!recordsEqual(prev.colorByCalendarId, next.colorByCalendarId))
    return false
  if (!recordsEqual(prev.legendLabels, next.legendLabels)) return false

  return true
}

export const GoogleCalendarView = memo(GoogleCalendarViewBase, areEqualProps)
