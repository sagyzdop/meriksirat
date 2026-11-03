# Start a booking (pickup)

> **Question:** What happens when a member starts a booking from
> the website?
>
> **Answer:** From 15 minutes before the booked start to 15 minutes
> after it, the booking page shows "Start Pickup". The member
> confirms with "Start Booking". The server records the actual start
> time, sets every live item to active, sets the booking to active,
> moves each calendar event to start now and keep its booked
> finish, and posts to the Telegram channel. If the club has a
> Global Booking Note and the member linked Telegram, the note is
> also sent to them as a message. The member sees "Booking started
> successfully".
>
> **Notes:**
> - Only the booking's owner can start it here. Admins cannot.
> - Before the window opens the server says "Booking can be started
>   up to 15 minutes before the start time". After it closes it says
>   "Booking start window has passed" and the booking is cancelled
>   by the clock, see ../cron/bookings/cancel-unstarted.md.
> - The same start logic is used by the Telegram Start Booking
>   command, see ../telegram/start-booking.md.
> - The Global Booking Note is the only reason that message is sent.
>   A failure sending it, or the channel post, is only logged.
> - Returning equipment is not possible on the website. See
>   return-booking.md.

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Calendar
    participant T as Telegram
    M->>B: Open the booking page inside the start window
    B-->>M: Start Pickup button shown
    M->>B: Tap Start Pickup
    B-->>M: Dialog "Start Pickup" with Not Now and Start Booking
    M->>B: Tap Start Booking
    B->>W: startBookingFn(bookingId)
    W->>D: Read session and the booking owner
    alt no session
        W-->>B: Error "Not authenticated"
    else booking missing
        W-->>B: Error "Booking not found"
    else not the owner
        W-->>B: Error "You can only start your own bookings"
    end
    W->>D: Read booking, owner and items
    alt status is not booked
        W-->>B: Error: Booking cannot be started from status<br/>#quot;X#quot; (X is the current status)
    else already has a start time
        W-->>B: Error "Booking has already been started"
    else more than 15 minutes before start
        W-->>B: Error "Booking can be started up to 15 minutes<br/>before the start time"
    else more than 15 minutes after start
        W-->>B: Error "Booking start window has passed#59;<br/>the booking will be auto-cancelled"
    else no live items
        W-->>B: Error "Booking has no items that can be started"
    end
    W->>D: Set started time = now, live items = active
    W->>D: Recompute booking status, becomes active
    loop each live item with an event
        W->>C: Update event to "item name (ACTIVE)",<br/>start now, finish as booked
    end
    W->>T: Post picked up log to the channel<br/>(see telegram/channel-log.md)
    W->>T: Send Global Booking Note to the member if set
    W-->>B: success
    B-->>M: Toast "Booking started successfully"
    B->>B: Refresh bookings queries and reload the page
    alt any error
        B-->>M: Toast with the error text or<br/>"Failed to start booking"
    end
```
