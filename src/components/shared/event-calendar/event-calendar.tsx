
import { useEffect, useMemo, useState } from "react"
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns"
import {
  CalendarCheck,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AgendaDaysToShow,
  AgendaView,
  CalendarDndProvider,
  CalendarEvent,
  CalendarView,
  DayView,
  EventDialog,
  EventGap,
  EventHeight,
  MonthView,
  WeekCellsHeight,
  WeekView,
} from "@/components/shared/event-calendar"

export interface EventCalendarProps {
  events?: CalendarEvent[]
  onEventAdd?: (event: CalendarEvent) => void
  onEventUpdate?: (event: CalendarEvent) => void
  onEventDelete?: (eventId: string) => void
  className?: string
  containerClassName?: string
  initialView?: CalendarView
  availableViews?: CalendarView[]
  readOnly?: boolean
  weekCellsHeight?: number
  onRangeChange?: (range: {
    start: Date
    end: Date
    view: CalendarView
  }) => void
}

export function EventCalendar({
  events = [],
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  className,
  containerClassName,
  initialView = "month",
  availableViews,
  readOnly = false,
  weekCellsHeight,
  onRangeChange,
}: EventCalendarProps) {
  const resolvedWeekCellsHeight = weekCellsHeight ?? WeekCellsHeight
  const [isMounted, setIsMounted] = useState(false)
  const resolvedViews = useMemo<CalendarView[]>(
    () =>
      availableViews && availableViews.length > 0
        ? availableViews
        : ["month", "week", "day", "agenda"],
    [availableViews]
  )
  const resolvedInitialView = useMemo<CalendarView>(
    () =>
      resolvedViews.includes(initialView)
        ? initialView
        : resolvedViews[0] || "month",
    [resolvedViews, initialView]
  )
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [view, setView] = useState<CalendarView>(resolvedInitialView)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    setCurrentDate(new Date())
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!resolvedViews.includes(view)) {
      setView(resolvedInitialView)
    }
  }, [resolvedInitialView, resolvedViews, view])

  // Add keyboard shortcuts for view switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea or contentEditable element
      // or if the event dialog is open
      if (
        isEventDialogOpen ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      const key = e.key.toLowerCase()
      if (key === "m" && resolvedViews.includes("month")) {
        setView("month")
      } else if (key === "w" && resolvedViews.includes("week")) {
        setView("week")
      } else if (key === "d" && resolvedViews.includes("day")) {
        setView("day")
      } else if (key === "a" && resolvedViews.includes("agenda")) {
        setView("agenda")
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isEventDialogOpen, resolvedViews])

  useEffect(() => {
    if (!currentDate) return
    if (!onRangeChange) return

    if (view === "month") {
      onRangeChange({
        start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }),
        view,
      })
      return
    }

    if (view === "week") {
      onRangeChange({
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
        view,
      })
      return
    }

    if (view === "day") {
      onRangeChange({
        start: startOfDay(currentDate),
        end: endOfDay(currentDate),
        view,
      })
      return
    }

    onRangeChange({
      start: startOfDay(currentDate),
      end: endOfDay(addDays(currentDate, AgendaDaysToShow - 1)),
      view,
    })
  }, [currentDate, onRangeChange, view])

  const handlePrevious = () => {
    if (!currentDate) return
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1))
    } else if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1))
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, -1))
    } else if (view === "agenda") {
      // For agenda view, go back 30 days (a full month)
      setCurrentDate(addDays(currentDate, -AgendaDaysToShow))
    }
  }

  const handleNext = () => {
    if (!currentDate) return
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1))
    } else if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1))
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, 1))
    } else if (view === "agenda") {
      // For agenda view, go forward 30 days (a full month)
      setCurrentDate(addDays(currentDate, AgendaDaysToShow))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleEventSelect = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsEventDialogOpen(true)
  }

  const handleEventCreate = (startTime: Date) => {
    if (readOnly) return

    // Snap to 15-minute intervals
    const minutes = startTime.getMinutes()
    const remainder = minutes % 15
    if (remainder !== 0) {
      if (remainder < 7.5) {
        // Round down to nearest 15 min
        startTime.setMinutes(minutes - remainder)
      } else {
        // Round up to nearest 15 min
        startTime.setMinutes(minutes + (15 - remainder))
      }
      startTime.setSeconds(0)
      startTime.setMilliseconds(0)
    }

    const newEvent: CalendarEvent = {
      id: "",
      title: "",
      start: startTime,
      end: addHours(startTime, 1),
      allDay: false,
    }
    setSelectedEvent(newEvent)
    setIsEventDialogOpen(true)
  }

  const handleEventSave = (event: CalendarEvent) => {
    if (readOnly) return
    if (event.id) {
      onEventUpdate?.(event)
      // Show toast notification when an event is updated
      toast(`Event "${event.title}" updated`, {
        description: format(new Date(event.start), "MMM d, yyyy"),
        position: "bottom-left",
      })
    } else {
      onEventAdd?.({
        ...event,
        id: Math.random().toString(36).substring(2, 11),
      })
      // Show toast notification when an event is added
      toast(`Event "${event.title}" added`, {
        description: format(new Date(event.start), "MMM d, yyyy"),
        position: "bottom-left",
      })
    }
    setIsEventDialogOpen(false)
    setSelectedEvent(null)
  }

  const handleEventDelete = (eventId: string) => {
    if (readOnly) return
    const deletedEvent = events.find((e) => e.id === eventId)
    onEventDelete?.(eventId)
    setIsEventDialogOpen(false)
    setSelectedEvent(null)

    // Show toast notification when an event is deleted
    if (deletedEvent) {
      toast(`Event "${deletedEvent.title}" deleted`, {
        description: format(new Date(deletedEvent.start), "MMM d, yyyy"),
        position: "bottom-left",
      })
    }
  }

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    if (readOnly) return
    onEventUpdate?.(updatedEvent)

    // Show toast notification when an event is updated via drag and drop
    toast(`Event "${updatedEvent.title}" moved`, {
      description: format(new Date(updatedEvent.start), "MMM d, yyyy"),
      position: "bottom-left",
    })
  }

  const viewTitle = useMemo(() => {
    if (!currentDate) return null
    if (view === "month") {
      return format(currentDate, "MMMM yyyy")
    } else if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      const end = endOfWeek(currentDate, { weekStartsOn: 0 })
      if (isSameMonth(start, end)) {
        return format(start, "MMMM yyyy")
      } else {
        return `${format(start, "MMM")} - ${format(end, "MMM yyyy")}`
      }
    } else if (view === "day") {
      return (
        <>
          <span className="min-[480px]:hidden" aria-hidden="true">
            {format(currentDate, "MMM d, yyyy")}
          </span>
          <span className="max-[479px]:hidden md:hidden" aria-hidden="true">
            {format(currentDate, "MMMM d, yyyy")}
          </span>
          <span className="max-md:hidden">
            {format(currentDate, "EEE MMMM d, yyyy")}
          </span>
        </>
      )
    } else if (view === "agenda") {
      // Show the month range for agenda view
      const start = currentDate
      const end = addDays(currentDate, AgendaDaysToShow - 1)

      if (isSameMonth(start, end)) {
        return format(start, "MMMM yyyy")
      } else {
        return `${format(start, "MMM")} - ${format(end, "MMM yyyy")}`
      }
    } else {
      return format(currentDate, "MMMM yyyy")
    }
  }, [currentDate, view])

  if (!isMounted || !currentDate) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-col rounded-lg border",
          containerClassName
        )}
        aria-busy="true"
      />
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-lg border has-data-[slot=month-view]:flex-1",
        containerClassName
      )}
      style={
        {
          "--event-height": `${EventHeight}px`,
          "--event-gap": `${EventGap}px`,
          "--week-cells-height": `${resolvedWeekCellsHeight}px`,
        } as React.CSSProperties
      }
    >
      <CalendarDndProvider onEventUpdate={handleEventUpdate}>
        <div
          className={cn(
            "flex items-center justify-between p-2 sm:p-4",
            className
          )}
        >
          <div className="flex items-center gap-1 sm:gap-4">
            <Button
              variant="outline"
              className="max-[479px]:aspect-square max-[479px]:p-0!"
              onClick={handleToday}
            >
              <CalendarCheck
                className="min-[480px]:hidden"
                size={16}
                aria-hidden="true"
              />
              <span className="max-[479px]:sr-only">Today</span>
            </Button>
            <div className="flex items-center sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                aria-label="Previous"
              >
                <ChevronLeftIcon size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                aria-label="Next"
              >
                <ChevronRightIcon size={16} aria-hidden="true" />
              </Button>
            </div>
            <h2 className="text-sm font-semibold sm:text-lg md:text-xl">
              {viewTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {resolvedViews.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5 max-[479px]:h-8">
                    <span>
                      <span className="min-[480px]:hidden" aria-hidden="true">
                        {view.charAt(0).toUpperCase()}
                      </span>
                      <span className="max-[479px]:sr-only">
                        {view.charAt(0).toUpperCase() + view.slice(1)}
                      </span>
                    </span>
                    <ChevronDownIcon
                      className="-me-1 opacity-60"
                      size={16}
                      aria-hidden="true"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-32">
                  {resolvedViews.includes("month") && (
                    <DropdownMenuItem onClick={() => setView("month")}>
                      Month <DropdownMenuShortcut>M</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )}
                  {resolvedViews.includes("week") && (
                    <DropdownMenuItem onClick={() => setView("week")}>
                      Week <DropdownMenuShortcut>W</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )}
                  {resolvedViews.includes("day") && (
                    <DropdownMenuItem onClick={() => setView("day")}>
                      Day <DropdownMenuShortcut>D</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )}
                  {resolvedViews.includes("agenda") && (
                    <DropdownMenuItem onClick={() => setView("agenda")}>
                      Agenda <DropdownMenuShortcut>A</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!readOnly && (
              <Button
                className="max-[479px]:aspect-square max-[479px]:p-0!"
                onClick={() => {
                  setSelectedEvent(null)
                  setIsEventDialogOpen(true)
                }}
              >
                <PlusIcon
                  className="opacity-60 sm:-ms-1"
                  size={16}
                  aria-hidden="true"
                />
                <span className="max-sm:sr-only">New event</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {view === "month" && resolvedViews.includes("month") && (
            <MonthView
              currentDate={currentDate}
              events={events}
              onEventSelect={handleEventSelect}
              onEventCreate={handleEventCreate}
              readOnly={readOnly}
            />
          )}
          {view === "week" && resolvedViews.includes("week") && (
            <WeekView
              currentDate={currentDate}
              events={events}
              onEventSelect={handleEventSelect}
              onEventCreate={handleEventCreate}
              readOnly={readOnly}
              weekCellsHeight={resolvedWeekCellsHeight}
            />
          )}
          {view === "day" && resolvedViews.includes("day") && (
            <DayView
              currentDate={currentDate}
              events={events}
              onEventSelect={handleEventSelect}
              onEventCreate={handleEventCreate}
              readOnly={readOnly}
              weekCellsHeight={resolvedWeekCellsHeight}
            />
          )}
          {view === "agenda" && resolvedViews.includes("agenda") && (
            <AgendaView
              currentDate={currentDate}
              events={events}
              onEventSelect={handleEventSelect}
            />
          )}
        </div>

        <EventDialog
          event={selectedEvent}
          isOpen={isEventDialogOpen}
          onClose={() => {
            setIsEventDialogOpen(false)
            setSelectedEvent(null)
          }}
          onSave={handleEventSave}
          onDelete={handleEventDelete}
          readOnly={readOnly}
        />
      </CalendarDndProvider>
    </div>
  )
}
