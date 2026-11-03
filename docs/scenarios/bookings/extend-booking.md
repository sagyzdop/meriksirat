# Extend a booking by 30 minutes

> **Question:** What happens when someone taps "Add 30 min"?
>
> **Answer:** The booking's finish time moves 30 minutes later if
> that stays inside the same club day and the operating hours, and
> every live item is free for the extra 30 minutes. The owner, or an
> admin or manager, taps "Add 30 min" and confirms. On success each
> item's calendar event gets the new finish time, the Telegram
> channel gets a post, and the toast says "Booking extended by 30
> minutes". On an overdue booking, if the new finish time is in the
> future, overdue items return to active and the member's overdue
> count goes down by one.
>
> **Notes:**
> - The button shows for booked, active, partially returned and
>   overdue bookings. It can be tapped repeatedly. It appears on
>   the booking page, the edit page and the expanded rows of the
>   lists, for members and admins.
> - The browser checks the limit first and shows a dialog "This
>   booking can't be extended" instead of the confirm dialog. The
>   server repeats the check. Both use club time and the closing
>   minute from the settings.
> - The availability check runs only when the person confirms, and
>   only for the extra 30 minutes after the current finish time.
> - If the new finish time is still in the past, the booking stays
>   overdue and the overdue count is not changed.
> - The overdue count never goes below 0.
> - The overdue marking itself is done by the clock, see
>   ../cron/bookings/mark-overdue.md.

```mermaid
sequenceDiagram
    autonumber
    participant P as Owner or admin
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Calendar
    participant T as Telegram
    P->>B: Tap Add 30 min
    alt finish plus 30 min passes midnight (club time)
        B-->>P: Dialog "This booking can't be extended"<br/>(crosses midnight), button Got it
    else finish plus 30 min is after closing time
        B-->>P: Dialog "This booking can't be extended"<br/>(past closing time), button Got it
    else extension allowed
        B-->>P: Dialog "Extend this booking by 30 minutes?"
    end
    P->>B: Tap Extend booking (shows Checking availability...)
    B->>W: extendBookingFn(bookingId)
    W->>D: Read session, booking, owner and operating hours
    alt not signed in or booking missing
        W-->>B: Error "Not authenticated" or "Booking not found"
    else not the owner and not admin or manager
        W-->>B: Error "Insufficient permissions"
    else cancelled or returned
        W-->>B: Error: A booking with status #quot;X#quot;<br/>cannot be extended (X is cancelled or returned)
    else past midnight
        W-->>B: Error "This booking cannot be extended past midnight"
    else past closing time
        W-->>B: Error "This booking cannot be extended beyond<br/>the club operating hours"
    else no live items
        W-->>B: Error "Booking has no items that can be extended"
    end
    W->>C: Free/busy for each live item, old finish to new finish
    alt any item busy
        W-->>B: Error "Cannot extend the booking: names is not<br/>available for the extra 30 minutes"
    end
    W->>D: Set finish time = old finish + 30 min
    opt new finish in the future and some items overdue
        W->>D: Overdue items = active, owner overdue count minus 1
    end
    W->>D: Recompute booking status
    loop each live item with an event
        W->>C: Update event title and finish time (see<br/>calendar-event-titles.md)
    end
    W->>T: Post extended log to the channel<br/>(see telegram/channel-log.md)
    W-->>B: success, new finish time, undidOverdue
    B-->>P: Toast "Booking extended by 30 minutes"<br/>or "...and the overdue status was reset"
    B->>B: Refresh bookings queries and reload the page
    alt any error
        B-->>P: Toast with the error text or<br/>"Failed to extend the booking"
    end
```
