# Cancel one item of a booking

> **Question:** What happens when someone cancels a single piece of
> equipment from a booking?
>
> **Answer:** On a booking that is still booked, "Cancel item" on a
> row opens the dialog "Cancel Item". On "Cancel Item" the server
> marks that one item cancelled, deletes its calendar event, and
> recalculates the booking status. The other items stay booked. If
> it was the last live item, the whole booking becomes cancelled.
> The person sees the toast "Item cancelled successfully" and the
> page refreshes.
>
> **Notes:**
> - The booking's owner can do this. An admin or manager can too.
> - The server checks the item belongs to the booking in the web
>   address, otherwise "Item not found".
> - The booking status is derived from its items: all cancelled
>   gives cancelled, all returned gives returned, any overdue gives
>   overdue, a mix of returned and live gives partially returned,
>   any active gives active, otherwise booked.
> - The Telegram channel post uses the same "cancelled" event as a
>   whole booking cancel. See the telegram folder.
> - Cancelling items is also available from the Telegram command
>   /cancel_booking, which uses the same item logic, see telegram
>   folder.
> - A failed calendar delete is only logged and the event stays.

```mermaid
sequenceDiagram
    autonumber
    participant P as Member or admin
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Calendar
    participant T as Telegram
    P->>B: Tap Cancel item on a row
    B-->>P: Dialog "Cancel Item" with Keep Item and Cancel Item
    P->>B: Tap Cancel Item
    B->>W: cancelBookingItemFn(bookingId, itemId)
    W->>D: Read session, the booking and its owner
    alt no session
        W-->>B: Error "Not authenticated"
    else booking missing
        W-->>B: Error "Booking not found"
    else not owner and not admin or manager
        W-->>B: Error "Insufficient permissions"
    else booking status is not booked
        W-->>B: Error "Items can only be added or cancelled<br/>while the booking has not started"
    end
    W->>D: Read the item
    alt item is not in this booking
        W-->>B: Error "Item not found"
    end
    W->>D: Set item status = cancelled (unless already cancelled<br/>or returned)
    alt nothing was changed
        W-->>B: Error "Item is already cancelled or returned"
    end
    W->>D: Recompute booking status from all items
    W->>C: Delete the item's calendar event
    W->>T: Post cancelled log to the channel (see telegram folder)
    W-->>B: success
    B-->>P: Toast "Item cancelled successfully"
    B->>B: Refresh all bookings queries and reload the page
    alt any error
        B-->>P: Toast with the error text or "Failed to cancel item"
    end
```
