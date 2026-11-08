# Pickup and return

## How does a member start a booking?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Google Calendar
    participant T as Telegram
    M->>B: Open the booking inside the start window
    B-->>M: Start Pickup button
    M->>B: Start Pickup, Start Booking
    B->>W: startBookingFn(bookingId)
    W->>W: Owner only, status booked, not started, now within 15 min of start
    W->>D: startedAt = now, live items active, booking recomputed to active
    W->>C: Update each event to "item name (ACTIVE)", start now, end as booked
    W->>T: Post "picked up" to the channel
    opt Settings have a Global Booking Note and Telegram is linked
        W->>T: Send the note to the member
    end
    W-->>B: OK
    B-->>M: Toast "Booking started successfully"
```

- The start window is 15 minutes before to 15 minutes after the start time ([GLOSSARY](../../../../GLOSSARY.md)). Before it: "Booking can be started up to 15 minutes before the start time". After it the booking is auto-cancelled as a no-show.
- The same logic backs the bot's Start Booking, see [start booking](../telegram/start-booking.md). Admins cannot start a member's booking from the web.
- The page decides the button when it loads. A window that opens later needs a reload.

## How does a member return equipment?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant T as Telegram
    participant W as Worker
    participant D as D1
    participant C as Google Calendar
    M->>B: Return Booking, or Return on one item
    B->>T: Open the bot chat in a new tab
    M->>T: /return_equipment, pick items, send a photo
    T->>W: returnBookingItems(item ids)
    W->>D: Skip returned and cancelled items, set returned with the time
    W->>D: Recompute booking status
    W->>C: Update event to "item name (RETURNED)", start actual start, end return time
    W-->>T: "Return logged for N item(s)", photo posted to the channel
```

- The web has no return action ([ADR-0004](../../../adr/0004-returns-are-telegram-only.md)). The link only opens the bot chat and does not pick the booking or items. Bot steps are in [return equipment](../telegram/return-equipment.md).
- Status after a return: all live items returned gives returned, some returned gives partially returned, and an overdue item keeps the booking overdue.
- The event ends at the actual return time even if later than booked. A failed event update is only logged.
