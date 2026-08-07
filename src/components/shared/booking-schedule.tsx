import { format } from "date-fns";
import { Section } from "@/components/layout/section";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleCalendarView } from "./event-calendar/google-calendar-view";
import { TimeSlotPicker } from "./time-slot-picker";

export interface BookingScheduleItem {
  equipment?: { googleCalendarId: string | null } | null;
}

interface BookingScheduleProps {
  items: BookingScheduleItem[];
  startTime: Date | string;
  endTime: Date | string;
  currentNotes?: string | null;
  canEdit?: boolean;
  initialSlots?: string[];
  disabled?: boolean;
  warnWhenLocked?: boolean;
  onSlotsChange?: (slots: string[], date: Date | undefined) => void;
}

/**
 * BookingSchedule renders the shared booking-editing sections:
 * - "Current Booking" (start/end times and current notes)
 * - "Availability" (Google Calendar view)
 * - "Update Date & Time" (time slot picker, or a lock warning when the
 *   booking can no longer be rescheduled)
 */
export function BookingSchedule({
  items,
  startTime,
  endTime,
  currentNotes,
  canEdit = false,
  initialSlots = [],
  disabled = false,
  warnWhenLocked = false,
  onSlotsChange,
}: BookingScheduleProps) {
  const calendarIds = items
    .map((item) => item.equipment?.googleCalendarId)
    .filter((id): id is string => Boolean(id));

  const hasCalendar = calendarIds.length > 0;
  const showDateEditor = hasCalendar && (canEdit || warnWhenLocked);

  return (
    <>
      <Section title="Current Booking" spacing="compact">
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <span className="font-medium">Start Time:</span>
            <p className="mt-1 text-muted-foreground">{format(new Date(startTime), "PPP p")}</p>
          </div>
          <div>
            <span className="font-medium">End Time:</span>
            <p className="mt-1 text-muted-foreground">{format(new Date(endTime), "PPP p")}</p>
          </div>
        </div>
        {currentNotes && (
          <div className="border-t pt-4">
            <span className="text-sm font-medium">Current Notes:</span>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{currentNotes}</p>
          </div>
        )}
      </Section>

      {hasCalendar && (
        <Section title="Availability" spacing="compact">
          <GoogleCalendarView calendarId={calendarIds[0]} />
        </Section>
      )}

      {showDateEditor && (
        <Section title="Update Date & Time" spacing="compact">
          {canEdit ? (
            <TimeSlotPicker
              googleCalendarIds={calendarIds}
              initialDate={new Date(startTime)}
              initialSlots={initialSlots}
              excludeBookingPeriod={{ start: startTime.toString(), end: endTime.toString() }}
              onSlotsChange={onSlotsChange}
              disabled={disabled}
            />
          ) : (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <p className="text-sm text-yellow-800">
                  Schedule updates are only available for <strong>booked</strong> or{" "}
                  <strong>active</strong> bookings.
                </p>
              </CardContent>
            </Card>
          )}
        </Section>
      )}
    </>
  );
}
