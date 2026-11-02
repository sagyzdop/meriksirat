# Edit a booking (admin)

> **Question:** What happens when an admin changes a booking's
> notes or time?
>
> **Answer:** On the admin Edit Booking page the admin edits the
> notes and, while the booking is still booked, picks new slots,
> then taps "Save Changes". The server checks no other booking is
> busy on the items' calendars for the new window, saves the notes
> and times, posts an "edited" message naming the admin, and
> updates each item's calendar event. The page shows "Booking
> updated successfully! Database and calendar have been
> synchronized." and goes back to Manage Bookings after 2 seconds.
>
> **Notes:**
> - Times are sent only if they differ from the saved ones, so a
>   notes-only save skips the availability check.
> - Unlike the member edit, there is no 1 hour advance check and no
>   48 hour, 60 day or operating hours check.
> - Notes are replaced as a whole. An empty note is saved as empty.
> - The server does not require status booked. The page shows the
>   schedule picker only for booked bookings, but the notes box is
>   always editable.
> - The event title keeps the status at the time of saving, for
>   example "item name - Booking (ACTIVE)". See
>   calendar-event-titles.md.
> - Overdue banner: for active or partially returned bookings whose
>   finish time has passed, the page shows "This booking is
>   overdue!" with the due date.
> - The page also has Cancel Booking, Add 30 min, Add More and
>   Cancel item. See admin-cancel-booking.md, extend-booking.md,
>   add-items.md and cancel-item.md.

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin or manager
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Calendar
    participant T as Telegram
    A->>B: Tap Edit on a booking
    B->>W: getAdminBookingByIdFn, getBookingSettingsFn,<br/>getTelegramBotUsernameFn
    W-->>B: Booking, operating hours, bot username
    alt any of these fails
        B-->>A: Error "Failed to load booking data"
    end
    A->>B: Change notes and slots, tap Save Changes
    alt booked and no slot selected
        B-->>A: Alert "Please select at least one time slot<br/>to update the schedule."
    end
    B->>W: updateBookingStatusAdminFn(bookingId, notes,<br/>startTime, endTime when changed)
    W->>D: Read session role, the booking and its items
    alt not admin or manager
        W-->>B: Error "Insufficient permissions"
    else booking missing
        W-->>B: Error "Booking not found"
    else booking has no items
        W-->>B: Error "Booking has no items"
    end
    opt times changed
        loop each item calendar
            W->>C: Free/busy for the new window
        end
        alt busy outside the booking's own period
            W-->>B: Error "Requested time conflicts with<br/>existing booking for item name"
        end
    end
    W->>D: Save notes, times if changed, updated time
    W->>D: Recompute booking status (stays the same)
    W->>T: Post edited log naming the admin (see telegram folder)
    loop each item with an event
        W->>C: Update event "item name - Booking (STATUS)"<br/>with new times and details
    end
    W-->>B: success, previous status, new status
    B-->>A: "Booking updated successfully! Database and calendar<br/>have been synchronized."
    B->>B: After 2 seconds go to Manage Bookings
    alt any error
        B-->>A: Red alert with the error text or<br/>"Failed to update booking. Please try again."
    end
```
