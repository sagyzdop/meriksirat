# Availability and calendar

Availability comes only from the equipment's Google Calendar, read with the club's master Google account for any signed-in user. A booking without a calendar event does not count.

## How does the list know what is free?

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant W as Worker
    participant C as Google Calendar
    B->>B: Build the window from date and times (default: next bookable half hour)
    B->>B: Split equipment calendars into groups of 40
    loop Each group, in parallel
        B->>W: checkMultipleCalendarsFreeBusy(calendarIds, timeMin, timeMax)
        loop Batches of 15 calendars
            W->>C: Free/busy query
        end
        W-->>B: Busy periods per calendar
    end
    alt A group fails
        B-->>B: Retry the whole check once, cards stay on "Checking..." if it fails again
    else All succeeded
        B-->>B: Calendar with any busy period is Unavailable, others Available
    end
```

- Default window: the next half-hour mark at least 60 minutes from now and inside operating hours, 30 minutes long. If none fits today it moves to opening time of the next club day. Changing the date, start or end time reruns the check.
- Items already in the booking being edited show "In booking".
- The server does not check event type, so what Google counts as busy decides. A calendar Google reports an error for is treated as free.

## How does the equipment calendar load?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant C as Google Calendar
    M->>B: Open the calendar (week view, month available) or change range
    B->>W: getCalendarEvents(calendarId, timeMin, timeMax)
    W->>C: List events, single events, up to 250, ordered by start
    alt Fails
        B-->>M: Toast "Failed to load calendar events"
    else Events returned
        B-->>M: Events drawn, read-only
    end
```

- Cancelled events are skipped. All-day events draw as all-day. An untitled event shows "(no title)". Beyond 250 events are not shown.
- The same calendar view backs the Availability section of the [new booking page](../bookings/create.md).
