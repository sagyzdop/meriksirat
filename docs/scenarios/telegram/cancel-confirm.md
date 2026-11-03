# Confirming a cancellation in Telegram

> **Question:** What happens when the member picks items to cancel
> and confirms?
>
> **Answer:** The bot asks "Cancel ...?" with Confirm and Cancel
> buttons. Confirm cancels the chosen items, recomputes the
> booking's status, deletes their calendar events and posts a
> "Cancelled" log in the club channel. The member sees
> "Cancelled NAMES (booking #35;id)." Cancel returns to the item list.
>
> **Notes:**
> - Ownership and status are re-checked at confirm time, so a stale
>   choice cannot cancel equipment that was picked up meanwhile.
> - Refusal texts: "No cancellable items found.", "Item not found.",
>   "This item has already been picked up and can only be
>   cancelled while it is still booked. Use the Return Equipment
>   flow instead." and "The selected items are already cancelled
>   or returned."
> - "⬅️ Back to bookings" goes back to the booking list.
> - The question reads `Cancel "NAME"?` for one item or
>   `Cancel all items in booking #35;id?` for all.
> - Other text at the confirm step gets "Send Confirm or Cancel."
> - If the chat is no longer linked, Confirm shows the main menu.
>   With no items saved it shows the booking list.
> - The saved step is not cleared after a cancel. Tapping Confirm
>   again gets the "already been picked up" refusal, although
>   the item was cancelled.
> - Channel log failures are logged to the console only.
> - Earlier steps are in `cancel-booking.md`. The log is in
>   `channel-log.md`.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Worker
    participant KV
    participant D1
    participant Calendar
    participant Telegram
    Member->>Worker: taps item number, "Cancel All Items (n)"<br/>or "⬅️ Back to bookings"
    alt Back to bookings
        Worker->>KV: step awaiting_cancel_selection
        Worker->>Telegram: renderCancelBookingList(ctx)
    else valid item choice
        Worker->>KV: step awaiting_cancel_confirm, pendingCancelItemIds
        Worker->>Telegram: Cancel label question<br/>buttons "✅ Confirm", "Cancel", "🏠 Main Menu"
    else invalid choice
        Worker->>Telegram: "Please tap one of the buttons above."
    end
    Member->>Worker: taps "✅ Confirm"
    Worker->>D1: cancelItems(ctx, userId, ids)<br/>keep this member's items with status booked
    alt refused
        Worker->>Telegram: refusal text + "🏠 Main Menu" button
    else cancelled
        Worker->>D1: cancelBookingItems sets items = cancelled,<br/>recompute booking status
        Worker->>Calendar: delete each item event
        Worker->>Telegram: logBookingActivityById(cancelled)<br/>to the club channel
        Worker->>Telegram: "Cancelled NAMES (booking #35;id)."<br/>+ "🏠 Main Menu" button
    end
    Member->>Worker: taps "Cancel" at the question
    Worker->>KV: step awaiting_cancel_items
    Worker->>Telegram: item list again, or booking list if no booking saved
```
