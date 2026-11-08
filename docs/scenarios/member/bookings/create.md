# Create a booking

## How does a member pick equipment and a time?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant C as Google Calendar
    M->>B: "View & Book Selected" on the equipment list
    B->>W: getBookingSettingsFn, getEquipmentByIdFn per id
    B->>W: getCalendarEvents per equipment calendar (Availability view)
    M->>B: Pick a day (today by default) and 30 minute slots
    B->>W: Free/busy for that day over all chosen calendars
    W->>C: Query, 15 calendars per request
    B->>B: Grey out slots outside operating hours, busy, or starting within 1 hour
    B-->>M: Book Equipment enables once a slot is picked
```

- The booking runs from the first picked slot to 30 minutes after the last. The picker works on one calendar day, so the browser never produces more than 24 hours.
- The busy check for a day uses the browser's midnight to midnight, not club time. The day picker has no upper limit, the server refuses starts beyond 60 days.
- Remove drops an item (removing the last one returns to the list). Add More returns to the list with the selection kept.
- Equipment lookup applies the member's clearance, see [detail](../equipment/detail.md).

## What happens on Confirm Booking?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Google Calendar
    participant T as Telegram
    M->>B: Fill Event Details (required), click Confirm Booking
    B->>W: createBookingFn(equipmentIds, startTime, endTime, notes)
    W->>W: Times valid, start at least 1 hour away, at most 48 hours long, start within 60 days
    W->>D: Member check (canBook), rate limit 10 per 60 s per member
    W->>D: Each equipment's calendar id
    W->>C: Free/busy for all item calendars
    alt Any busy period
        W-->>B: "Requested time conflicts with existing booking(s)"
    else Free
        W->>D: Insert booking, status booked, notes, owner
        W->>C: Create one event per item and insert the booking items
        W->>T: Post "booked" to the channel
        W-->>B: bookingId
        B-->>M: Toast with the booking id, open /bookings/id
    end
```

- Every failed check is an error toast and nothing is saved. Notes are required by the dialog but optional on the server (up to 500 characters). One request holds 1 to 10 items, repeated ids merged.
- Operating hours are enforced only by the slot picker. The server also does not recheck clearance or that the equipment is active.
- The toast never names the conflicting items.
- A failed channel post is only logged.

## What happens if Google Calendar fails halfway?

```mermaid
sequenceDiagram
    autonumber
    participant W as Worker
    participant C as Google Calendar
    participant D as D1
    participant M as Member
    loop Each item in order
        W->>C: Create event "item name - Booking" (up to 3 tries, waits 400, 800, 1200 ms)
        W->>D: Insert booking item with the event id
    end
    alt An item fails
        loop Items already created
            W->>C: Delete its event
            W->>D: Delete its booking item
        end
        W->>D: Delete the booking row
        W-->>M: Error toast with the original message
    end
```

- Each rollback step is attempted on its own. A failure is logged and the rest continues, so a leftover event is possible.
- If an event is made but its item row cannot be saved, that event is not in the rollback list and stays in the calendar.
- The same code adds items to an existing booking, see [edit](edit.md). There a failure removes only the new items.
- Event titles over a booking's life are in [calendar titles](calendar-titles.md).
