# Add equipment to an existing booking

> **Question:** How does a member add more equipment to a booking
> that has not started?
>
> **Answer:** From the booking page the member taps "Add More",
> ticks equipment in the catalog (items already in the booking are
> disabled) and taps "Add to Booking". The browser re-checks the
> booking's time window for the chosen items, returns to the booking
> page, and the server adds each new item with its own calendar
> event, using the booking's existing times. The member sees the
> toast "Added N items to this booking" and the page refreshes.
> This works only while the booking has status booked.
>
> **Notes:**
> - The owner can do this. An admin or manager can also do it for
>   someone else's booking, and the events then carry the owner's
>   name.
> - Rate limit: 10 requests per 60 seconds per signed-in person.
> - Items already in the booking are dropped from the request. If
>   that leaves nothing, the server refuses. The toast adds
>   "N already included" when only some were dropped.
> - A request carries 1 to 10 items. The server does not cap the
>   total number of items in the booking.
> - The two small lookups (current item ids and booking window) have
>   the same status and ownership checks as the add call.
> - A failed calendar write removes only the new items, see
>   create-booking-rollback.md. The booking stays.
> - The booking's own status does not change, because new items
>   start as booked.
> - The Telegram channel gets an "items added" post, see the
>   telegram folder.

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Calendar
    M->>B: Tap Add More on the booking page
    B->>W: getBookingItemEquipmentIdsFn(bookingId)<br/>and getBookingWindowFn(bookingId)
    W->>D: Check owner or admin and status booked
    alt not owner and not admin or manager
        W-->>B: Error "Insufficient permissions"
    else status is not booked
        W-->>B: Error "Items can only be added or cancelled<br/>while the booking has not started"
    end
    W-->>B: Equipment ids in the booking, start and finish
    M->>B: Tick equipment, tap Add to Booking
    B->>C: Free/busy for the chosen items in the window
    alt a chosen item is busy
        B-->>M: Toast "name is not available during this<br/>booking's time window"
    end
    B->>B: Go to the booking page with equipmentIds
    B->>W: addBookingItemsFn(bookingId, equipmentIds)
    W->>W: Rate limit 10 per 60 s
    alt over the limit
        W-->>B: Error "Too many requests. Please try again shortly."
    end
    W->>D: Drop items already in the booking
    alt nothing left to add
        W-->>B: Error "Selected equipment is already part of this booking"
    end
    W->>C: Free/busy for the new items in the booking window
    alt any busy
        W-->>B: Error "Requested time conflicts with existing<br/>booking(s) for item names"
    end
    W->>C: Create one event per new item and insert booking items
    W->>D: Touch the booking's updated time, log items added
    W-->>B: success, added count
    B-->>M: Toast "Added N items to this booking"
    B->>B: Refresh bookings queries and clear equipmentIds
    alt any error
        B-->>M: Toast with the error text or<br/>"Failed to add equipment to this booking"
    end
```
