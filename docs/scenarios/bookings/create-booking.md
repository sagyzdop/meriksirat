# Create a booking

> **Question:** What happens when a member confirms a new booking?
>
> **Answer:** The member fills in Event Details (required in the
> dialog) and taps "Confirm Booking". The server checks the times,
> that the person is a club member, and that they are under the
> rate limit, then asks Google Calendar whether every chosen item is
> free. If so it saves one booking with status booked, adds one
> booking item and one calendar event per piece of equipment, posts
> to the Telegram channel, and the member lands on the booking's
> page with a success toast. Any failed check shows an error toast
> and nothing is saved.
>
> **Notes:**
> - Time rules checked first, before sign-in: finish after start,
>   start at least 1 hour from now, length at most 48 hours, start
>   within 60 days.
> - Operating hours are not checked here. They are enforced only by
>   the slot picker in choose-equipment-and-time.md.
> - Rate limit: 10 creations per 60 seconds per member. If the
>   limiter itself breaks, requests are let through.
> - One request can carry 1 to 10 items. Repeated ids are merged.
>   Notes are optional for the server and at most 500 characters.
> - Event titles and what happens if calendar writes fail are in
>   create-booking-rollback.md. Titles at every step are in
>   calendar-event-titles.md.
> - The Telegram channel post is described in the telegram folder.
>   A failed post is only logged and does not stop the booking.

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Calendar
    participant T as Telegram
    M->>B: Tap Book Equipment, fill Event Details
    B->>B: Confirm Booking stays disabled while notes are blank
    M->>B: Tap Confirm Booking (button shows Creating...)
    B->>W: createBookingFn(equipmentIds, startTime, endTime, notes)
    alt finish not after start
        W-->>B: Error "Invalid booking times"
    else start under 1 hour from now
        W-->>B: Error "Bookings must start at least 1 hour from now.<br/>Please select a later time slot."
    else longer than 48 hours
        W-->>B: Error "Bookings cannot be longer than 48 hours."
    else start more than 60 days away
        W-->>B: Error "Bookings must start within 60 days."
    end
    W->>D: Read session and the member's access rules
    alt not signed in
        W-->>B: Error "Not authenticated"
    else not a club member
        W-->>B: Error "Only club members can book equipment"
    end
    W->>W: Rate limit rl_create_booking, 10 per 60 s per member
    alt over the limit
        W-->>B: Error "Too many booking requests.<br/>Please try again shortly."
    end
    W->>D: Read each equipment calendar id
    alt an item has no calendar
        W-->>B: Error "No calendar configured for equipment id"
    end
    W->>C: Free/busy for all item calendars in the window
    alt any calendar has a busy period
        W-->>B: Error "Requested time conflicts with<br/>existing booking(s)" listing the item ids
        B-->>M: Toast "Time slot unavailable for: item names"<br/>or the error text if no ids came back
    end
    W->>D: Insert booking, status booked, notes, owner
    W->>C: Create one event per item and insert booking items<br/>(see create-booking-rollback.md)
    W->>T: Post booked log to the channel (see telegram folder)
    W-->>B: bookingId
    B-->>M: Toast "Booking created successfully! Booking ID: bookingId"
    B->>B: Clear picked slots, notes and saved selection
    B->>B: Go to the booking page /bookings/bookingId
```
