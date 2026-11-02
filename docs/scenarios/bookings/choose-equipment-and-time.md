# Choose equipment and a time slot

> **Question:** How does a member pick equipment and a time slot,
> and which times can they pick?
>
> **Answer:** The member ticks equipment in the catalog and taps
> "View & Book Selected", which opens the New Booking page. The page
> loads the club's operating hours, shows each item's calendar, and
> lets the member pick one day and a run of 30 minute slots. Slots
> outside operating hours, slots that overlap a busy period on any
> chosen item's calendar, and slots starting within the next hour are
> greyed out and cannot be clicked. "Book Equipment" stays disabled
> until at least one slot is picked.
>
> **Notes:**
> - Operating hours are stored as minutes since midnight in club
>   time. A slot is offered only if it starts at or after the opening
>   minute and finishes at or before the closing minute.
> - The picker works on one calendar day, so a booking made here
>   can never pass 24 hours. The 48 hour limit and the 60 day limit
>   are checked only by the server, in create-booking.md.
> - The calendar widget blocks days before today but has no upper
>   limit, so a day over 60 days away can be picked and is refused
>   later by the server.
> - Picking slots fills the gap: the booking runs from the first
>   picked slot to 30 minutes after the last picked slot.
> - The selection is kept in the browser under the key
>   equipment-selection. The server does not store it.
> - The equipment lookup is in the equipment folder. The free/busy
>   and calendar view calls belong to the Google calendar helpers.
> - Next step: create-booking.md.

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant C as Calendar
    M->>B: Tick equipment, tap View and Book Selected
    B->>B: Go to New Booking page with equipmentIds
    B->>W: getBookingSettingsFn()
    W-->>B: Note, operating hours start and finish<br/>(defaults 0 and 1439 minutes)
    alt settings call fails
        B->>B: Log the error and show the page anyway<br/>with the default hours 0 to 1439
    end
    B->>W: getEquipmentByIdFn for each id<br/>(see equipment folder)
    alt no equipment found
        B-->>M: Toast "Equipment not found"
    else lookup throws
        B-->>M: Toast "Failed to load equipment"
    end
    B->>W: getCalendarEvents for the Availability view
    W->>C: Read events of each equipment calendar
    M->>B: Pick a day (today or later)
    B->>W: checkMultipleCalendarsFreeBusy for the whole day<br/>(one item uses checkCalendarFreeBusy)
    W->>C: Free/busy for 00:00 to 23:59 of that day
    C-->>B: Busy periods per calendar
    alt free/busy call fails
        B-->>M: Toast "Failed to load availability"
    end
    B->>B: Build 30 minute slots inside operating hours
    B->>B: Grey out busy slots and slots starting<br/>within 1 hour from now
    M->>B: Click slots (range is filled between first and last)
    B-->>M: Shows "Booking for day from HH:mm to HH:mm"
    B-->>M: Book Equipment button becomes enabled
```
