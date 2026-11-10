# Return equipment with a photo

Related: [ADR-0004](../../../adr/0004-returns-are-telegram-only.md), [channel log](notifications.md), [bot routing](bot-routing.md).

## How does a member return equipment?

Returns exist only in Telegram. Items with status `active` or `overdue` can be returned. There is no time filter, so an early return works.

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant W as Worker
    participant D as D1
    participant K as D1 app_state
    participant C as Calendar
    participant T as Telegram
    M->>W: "↩️ Return Equipment" or /return_equipment
    W->>D: Bookings with active or overdue items
    alt None
        W->>T: "You have no active bookings to return."
    else Some
        W->>K: Step awaiting_booking_selection
        W->>T: Booking buttons
    end
    M->>W: Taps a booking
    W->>K: Step awaiting_item_selection
    W->>T: Numbered items, buttons 1..n and "Return All Items"
    M->>W: Taps an item or all
    W->>K: Step awaiting_photo with the item ids
    W->>T: "Send a photo of the equipment."
    M->>W: Sends a photo
    alt No awaiting_photo step, no selected items, or already returned
        W-->>M: No reply
    else Items updated
        W->>D: Items returned with returned_at, booking status recomputed
        W->>C: Item events updated with the real return time
        W->>T: Photo with a "✅ Returned" caption to the club channel
        W->>T: "✅ Return logged for N item(s). Photo sent to the club channel."
    end
```

- The largest size of the photo is forwarded. The photo handler does not check the link, it relies on the saved selection.
- On a database error the member sees "❌ Error processing return. Please try again." and can send the photo again.
- "Photo sent to the club channel." is shown even if channel logging is off or the post fails.
- Returning the last item makes the booking `returned`, see [GLOSSARY](../../../../GLOSSARY.md).
