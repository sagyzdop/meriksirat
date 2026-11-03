# Selecting equipment and moving on to a booking

> **Question:** How does a member pick equipment on the list and
> start a booking, or add more items to an existing booking?
>
> **Answer:** The member presses Select on one or more cards, then
> presses "View & Book Selected", which opens the new-booking page
> with those items. Creating the booking is covered in
> `../bookings/create-booking.md`. When the member came from an
> existing booking through "Add More", the button reads "Add to
> Booking". Before returning, the page checks the chosen items
> against that booking's time window and refuses if any item is busy.
>
> **Notes:**
> - The selection is remembered in the browser's local storage under
>   `equipment-selection`, so it survives reloads. Arriving in
>   add-to-booking mode clears it first.
> - In normal mode a card with an "Unavailable" badge can still be
>   selected. Only items already in the booking cannot be selected.
> - The check in add-to-booking mode runs again for the whole list
>   in groups of 40, not only for the chosen items. If that run
>   fails and an earlier answer exists, the earlier answer is used.
>   If none exists, every item counts as free. No error is shown.
> - In add-to-booking mode the Back button returns to the booking
>   and the header shows "Adding to booking #" with the booking id
>   and the time window.
> - The new-booking page continues in
>   `../bookings/choose-equipment-and-time.md`. Adding the items to
>   the booking continues in `../bookings/add-items.md`.
> - Add-to-booking mode without a return address opens the
>   new-booking page like normal mode.
> - The toast says "are" instead of "is" when several items conflict.
> - "Clear selection" appears when at least one item is selected.
>   The button is disabled while nothing is selected.

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant B as Browser
    participant W as Worker
    participant C as Calendar
    M->>B: Press Select on cards
    B->>B: save selected ids to local storage
    M->>B: Press "View & Book Selected" or "Add to Booking"
    alt Normal mode, or no return address
        B->>B: open /bookings/new with equipmentIds
        Note over B: continues in<br/>../bookings/choose-equipment-and-time.md
    else Add-to-booking mode
        B->>W: checkMultipleCalendarsFreeBusy(<br/>equipmentCalendarIds, booking start, end)
        W->>C: free/busy query using master account token
        C-->>W: busy periods
        W-->>B: busy periods per calendar
        alt Any selected item is busy
            B-->>M: Toast "NAME is not available during<br/>this booking's time window"
        else All free
            B->>B: go back to returnTo with equipmentIds,<br/>replacing this history entry
            Note over B: continues in<br/>../bookings/add-items.md
        end
    end
```
