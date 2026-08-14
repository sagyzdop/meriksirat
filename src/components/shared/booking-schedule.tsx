import { Section } from '@/components/layout/section'
import { GoogleCalendarView } from './event-calendar/google-calendar-view'
import type { EventColor } from './event-calendar'
import { TimeSlotPicker } from './time-slot-picker'

const CALENDAR_PALETTE: EventColor[] = [
  'sky',
  'amber',
  'violet',
  'rose',
  'emerald',
  'orange',
]

export interface BookingScheduleItem {
  equipment?: {
    googleCalendarId: string | null
    modelName?: string | null
  } | null
}

interface BookingScheduleProps {
  items: BookingScheduleItem[]
  startTime: Date | string
  endTime: Date | string
  canEdit?: boolean
  initialSlots?: string[]
  disabled?: boolean
  warnWhenLocked?: boolean
  onSlotsChange?: (slots: string[], date: Date | undefined) => void
}

/**
 * BookingSchedule renders the shared booking-editing sections:
 * - "Availability" (Google Calendar view)
 * - "Update Date & Time" (time slot picker, or a lock warning when the
 *   booking can no longer be rescheduled)
 */
export function BookingSchedule({
  items,
  startTime,
  endTime,
  canEdit = false,
  initialSlots = [],
  disabled = false,
  warnWhenLocked = false,
  onSlotsChange,
}: BookingScheduleProps) {
  const calendarIds = items
    .map((item) => item.equipment?.googleCalendarId)
    .filter((id): id is string => Boolean(id))

  const legendLabels = items.reduce<Record<string, string>>((acc, item) => {
    const calendarId = item.equipment?.googleCalendarId
    if (calendarId) {
      acc[calendarId] = item.equipment?.modelName || calendarId
    }
    return acc
  }, {})

  const colorByCalendarId = Object.keys(legendLabels).reduce<
    Record<string, EventColor>
  >((acc, calendarId, index) => {
    acc[calendarId] = CALENDAR_PALETTE[index % CALENDAR_PALETTE.length]
    return acc
  }, {})

  const hasCalendar = calendarIds.length > 0
  const showDateEditor = hasCalendar && (canEdit || warnWhenLocked)

  return (
    <>
      {hasCalendar && (
        <Section title="Availability" spacing="compact">
          <GoogleCalendarView
            calendarIds={calendarIds}
            colorByCalendarId={colorByCalendarId}
            legendLabels={legendLabels}
          />
        </Section>
      )}

      {showDateEditor && (
        <Section title="Update Date & Time" spacing="compact">
          {canEdit ? (
            <TimeSlotPicker
              googleCalendarIds={calendarIds}
              initialDate={new Date(startTime)}
              initialSlots={initialSlots}
              excludeBookingPeriod={{
                start: startTime.toString(),
                end: endTime.toString(),
              }}
              onSlotsChange={onSlotsChange}
              disabled={disabled}
            />
          ) : (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              Schedule updates are only available for <strong>booked</strong> or{' '}
              <strong>active</strong> bookings.
            </div>
          )}
        </Section>
      )}
    </>
  )
}
