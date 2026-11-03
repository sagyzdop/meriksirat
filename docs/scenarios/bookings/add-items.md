# Add equipment to an existing booking

> **Question:** How does a member add more equipment to a booking
> that has not started?
>
> **Answer:** On a booking that has not started, the member taps
> "Add More", ticks equipment in the catalog (items already in the
> booking are greyed out) and taps "Add to Booking". The browser
> checks the booking's time window for the chosen items and returns
> to the booking page. There the server adds each new item with its
> own calendar event, using the booking's existing times, and the
> member sees a toast such as "Added 2 items to this booking". Only
> bookings with status booked can be changed this way.
>
> **Notes:**
> - The owner can do this. An admin or manager can also do it for
>   someone else's booking, and the events then carry the owner's
>   name. Being a club member is not checked here.
> - Rate limit: 10 requests per 60 seconds per signed-in person. It
>   is checked before the booking is looked up. If the limiter
>   itself breaks, requests are let through.
> - Items already in the booking are dropped from the request. This
>   includes items that were cancelled earlier in the same booking.
>   If nothing is left, the server refuses. If only some were
>   dropped, the toast adds "K already included", with K the number
>   dropped. The word is "item" when N is 1.
> - A request carries 1 to 10 items. The server does not cap the
>   total number of items in the booking.
> - The two lookups the catalog page makes (items already in the
>   booking, and the booking window) run the same ownership and
>   status checks as the add call. If one fails, the page logs it
>   and shows the catalog without greying out items.
> - A failed calendar write removes only the new items, see
>   create-booking-rollback.md. The booking stays.
> - The booking's own status does not change, because new items
>   start as booked.
> - The Telegram channel gets an "items added" post, see
>   ../telegram/channel-log.md.

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
        B-->>M: Toast "name is not available during this<br/>booking's time window" (are for several)
    end
    B->>B: Go to the booking page with equipmentIds
    B->>W: addBookingItemsFn(bookingId, equipmentIds)
    alt not signed in
        W-->>B: Error "Not authenticated"
    end
    W->>W: Rate limit rl_add_booking_items, 10 per 60 s
    alt over the limit
        W-->>B: Error "Too many requests. Please try again shortly."
    end
    W->>D: Same owner and status checks, read booking and items
    alt booking missing, wrong owner or not status booked
        W-->>B: Error "Booking not found", "Insufficient<br/>permissions" or the status error above
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
    W->>D: Set the booking's updated time, post items added log
    W-->>B: success, added count
    B-->>M: Toast "Added N items to this booking"
    B->>B: Refresh bookings queries and clear equipmentIds
    alt any error
        B-->>M: Toast with the error text or<br/>"Failed to add equipment to this booking"
    end
```
