# Edit a booking and add items

Only a booking with status booked shows the edit form. Edit Booking is on the [details page](details.md).

## How does a member change time or notes?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant C as Google Calendar
    participant T as Telegram
    M->>B: Change notes and slots, click Save Changes
    B->>W: updateBookingFn(bookingId, startTime, endTime, notes)
    W->>W: Owner check, booking not cancelled, new start at least 1 hour away
    loop Each item calendar
        W->>C: Free/busy for the new window
    end
    alt Busy period outside the booking's own period
        W-->>B: "Requested time conflicts with existing booking for NAME"
    else Free
        W->>W: Save times and notes
        W->>T: Post "edited" with the previous times and notes
        loop Each item with an event
            W->>C: Update event to "item name - Booking" with the new times
        end
        W-->>B: OK
        B-->>M: Toast "Booking updated successfully!", back to My Bookings after 1.5 s
    end
```

- The page always sends times and notes, so the availability check and the 1-hour rule apply even to a notes-only edit.
- The booking's own busy period is ignored: a busy period lying fully inside the booking's current period (from the actual start if there is one) is not a conflict.
- The server does not repeat the 48 hour, 60 day or operating hours checks. Items cancelled earlier are still included in the check and event update.
- A failed event update is only logged, so the database can run ahead of the calendar.

## How does a member add equipment?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant C as Google Calendar
    M->>B: Add More on the booking page
    B->>B: Equipment list in add-to-booking mode, see ../equipment/browse.md
    M->>B: Select items, Add to Booking
    B->>B: Window check passes, return with equipmentIds
    B->>W: addBookingItemsFn(bookingId, equipmentIds)
    W->>W: Rate limit 10 per 60 s, owner or admin or manager, status booked
    W->>W: Drop items already in the booking, refuse if none left
    W->>C: Free/busy for the new items over the booking's window
    alt Any busy
        W-->>B: "Requested time conflicts with existing booking(s) for NAMES"
    else Free
        W->>C: Create one event per new item and insert the items
        W-->>B: added count
        B-->>M: Toast "Added N items to this booking"
    end
```

- New items use the booking's existing times and start as booked, so the booking status does not change. Dropped duplicates (including items cancelled earlier) add "K already included" to the toast.
- Membership is not rechecked here. An admin or manager can also add items to someone else's booking.
- A failed calendar write removes only the new items, see the rollback in [create](create.md). The channel gets an "items added" post.
