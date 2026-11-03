# Choosing what to return in Telegram

> **Question:** What happens when a member taps "Return Equipment"
> or sends `/return_equipment`?
>
> **Answer:** The bot lists the member's bookings that have picked
> up equipment (active or overdue items), then the items of the
> chosen booking as numbered buttons plus "Return All Items".
> After a choice it asks for a photo of the equipment, which is
> handled in `return-photo.md`.
>
> **Notes:**
> - Only items with status active or overdue can be returned. Items
>   still "booked" must be cancelled instead. There is no time
>   filter, so a booking started early can be returned early.
> - The saved steps are `awaiting_booking_selection`, then
>   `awaiting_item_selection`, then `awaiting_photo`. Each save
>   expires after 1 hour in KV.
> - A choice that is not a button gets "Please tap one of the
>   buttons above."
> - If the chat is no longer linked, picking a booking gets "Please
>   link your account via /start first." and picking an item
>   shows the main menu.
> - Item numbers are positions in the list (1, 2, 3 ...), read back
>   against the current list of returnable items.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Worker
    participant D1
    participant KV
    participant Telegram
    Member->>Worker: /return_equipment or "↩️ Return Equipment"<br/>renderEndBookingList(ctx)
    Worker->>D1: requireLinkedUser then fetchUserBookings<br/>item status active, overdue
    alt chat not linked
        Worker->>Telegram: "Please link your account via /start first."
    else no bookings
        Worker->>Telegram: "You have no active bookings to return."
    else bookings found
        Worker->>KV: session awaiting_booking_selection
        Worker->>Telegram: "Select which booking to return:"<br/>buttons "Booking #35;id — equipment" + "🏠 Main Menu"
    end
    Member->>Worker: taps a booking button<br/>handleFlowText
    Worker->>KV: session awaiting_item_selection, booking id
    Worker->>D1: renderReturnItemSelection<br/>fetchBookingItems for this member
    alt no returnable items
        Worker->>Telegram: "No items to return for this booking."
        Worker->>Telegram: renderEndBookingList again
    else items found
        Worker->>Telegram: "Select which items to return for booking<br/>#35;id:" numbered list, buttons 1..n,<br/>"Return All Items", "🏠 Main Menu"
    end
    Member->>Worker: taps a number or "Return All Items"
    alt not a valid choice
        Worker->>Telegram: "Please tap one of the buttons above."
    else valid
        Worker->>KV: session awaiting_photo, selectedItemIds
        Worker->>Telegram: "Send a photo of the equipment."<br/>+ "🏠 Main Menu" button
    end
```
