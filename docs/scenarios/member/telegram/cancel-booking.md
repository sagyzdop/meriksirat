# Cancel a booking from Telegram

Related: [bot routing](bot-routing.md), [cancel on the web](../bookings/), [channel log](notifications.md).

## How does a member cancel items through the bot?

Cancelling works per item, so one item of a multi-item booking can be cancelled alone. Only items still `booked` qualify. Picked-up equipment goes through [return](return-equipment.md).

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant W as Worker
    participant D as D1
    participant K as D1 app_state
    participant C as Calendar
    participant T as Telegram
    M->>W: "❌ Cancel Booking" or /cancel_booking
    W->>D: Bookings with booked items
    alt None
        W->>T: "You have no upcoming bookings to cancel."
    else Some
        W->>K: Step awaiting_cancel_selection
        W->>T: Booking buttons
    end
    M->>W: Taps a booking
    W->>K: Step awaiting_cancel_items
    W->>T: Numbered items with buttons 1..n, "Cancel All Items (n)", "⬅️ Back to bookings"
    M->>W: Taps an item or all
    W->>K: Step awaiting_cancel_confirm with the item ids
    W->>T: Question with Confirm and Cancel
    M->>W: "✅ Confirm"
    W->>D: Re-check owner and status booked, then set items cancelled and recompute the booking status
    alt Nothing cancellable
        W->>T: Refusal text, for example the item was already picked up
    else Cancelled
        W->>C: Delete each item event
        W->>T: Channel log "❌ Cancelled", then "Cancelled NAMES (booking #id)."
    end
```

- Ownership and status are checked again at confirm, so a stale choice cannot cancel equipment picked up in the meantime.
- "Cancel" at the question returns to the item list. The saved step is not cleared after a cancel, so a second Confirm gets a refusal.
