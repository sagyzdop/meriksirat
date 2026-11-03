# Choosing what to cancel in Telegram

> **Question:** What happens when a member taps "Cancel Booking" or
> sends `/cancel_booking`?
>
> **Answer:** The bot lists the member's bookings that still have
> items in the "booked" state, then the items of the chosen
> booking as numbered buttons with "Cancel All Items (n)" and
> "⬅️ Back to bookings". Choosing an item or all items leads to
> the confirmation in `cancel-confirm.md`.
>
> **Notes:**
> - Only items not yet picked up can be cancelled. Picked-up
>   equipment goes through the return flow.
> - Saved steps are `awaiting_cancel_selection`, then
>   `awaiting_cancel_items`, each expiring after 1 hour.
> - The cancel is per item, so one item of a multi-item booking can
>   be cancelled alone.
> - Text that is not a booking button gets "Please tap one of the
>   buttons above."
> - If the chat is no longer linked, picking a booking gets "Please
>   link your account via /start first."

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Worker
    participant D1
    participant KV
    participant Telegram
    Member->>Worker: /cancel_booking or "❌ Cancel Booking"<br/>renderCancelBookingList(ctx)
    Worker->>D1: requireLinkedUser then fetchUserBookings<br/>item status booked
    alt chat not linked
        Worker->>Telegram: "Please link your account via /start first."
    else no bookings
        Worker->>Telegram: "You have no upcoming bookings to cancel."
    else bookings found
        Worker->>KV: session awaiting_cancel_selection
        Worker->>Telegram: "Select which booking to cancel:"<br/>buttons "Booking #35;id — equipment" + "🏠 Main Menu"
    end
    Member->>Worker: taps a booking button<br/>handleFlowText
    alt text has no Booking #35;number
        Worker->>Telegram: "Please tap one of the buttons above."
    else number found
        Worker->>KV: session awaiting_cancel_items, cancelBookingId
        Worker->>D1: renderCancelBookingItems<br/>fetchBookingItems status booked
        alt no cancellable items left
            Worker->>Telegram: "Booking #35;id has no cancellable items left."
        else items found
            Worker->>Telegram: "Booking #35;id", numbered items, "Send the<br/>number of the item you want to cancel:"<br/>buttons 1..n, "Cancel All Items (n)",<br/>"⬅️ Back to bookings", "🏠 Main Menu"
        end
    end
```
