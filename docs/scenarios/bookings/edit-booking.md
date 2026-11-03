# Edit a booking (member)

> **Question:** What happens when a member changes the time or the
> notes of a booking?
>
> **Answer:** On the Edit Booking page of a booking that is still
> booked, the member changes the notes and picks new slots, then taps
> "Save Changes". The server checks the new start is at least 1 hour
> away and that no other booking is busy on any of the items'
> calendars, saves the new times and notes, and renames and moves
> each item's calendar event. The button stays disabled until at
> least one slot is picked. The member sees the toast "Booking
> updated successfully!" and returns to My Bookings after 1.5
> seconds. Bookings that have started show no edit form.
>
> **Notes:**
> - The page always sends the picked start, finish and notes, so the
>   availability check runs on every save, even for a notes-only edit.
> - The booking's own busy period is ignored in the check. A busy
>   period counts as the booking's own when it lies fully inside the
>   booking's current period (from the actual start, if there is
>   one).
> - Besides the owner check, the server rejects only cancelled
>   bookings. It does not repeat the 48 hour, 60 day,
>   finish-after-start or operating hours checks that creation
>   does, and it does not require status booked. The page only
>   offers the form while status is booked.
> - Items cancelled earlier in the booking are still included in
>   the busy check and the event update.
> - The new start is refused only when it is earlier than 1 hour
>   from now. A notes-only edit from the page still sends the
>   times, so it can be refused for the same reason if the
>   booking starts in under an hour.
> - Calendar event updates that fail are only logged, so the
>   database can be ahead of the calendar.
> - The edit page also offers Cancel Booking, Add 30 min, Add More
>   equipment and Cancel item. See cancel-booking.md,
>   extend-booking.md, add-items.md and cancel-item.md.
> - The Telegram channel gets an "edited" post with the previous
>   times and notes, see ../telegram/channel-log.md.

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Calendar
    participant T as Telegram
    M->>B: Tap Edit on a booked booking
    B->>W: getBookingByIdFn, getBookingSettingsFn,<br/>getTelegramBotUsernameFn
    W-->>B: Booking, operating hours, bot username
    alt booking or bot username call fails
        B-->>M: Error "Failed to load booking data"<br/>(a settings failure is only logged)
    end
    B->>B: Pre-select the booking's current 30 minute slots
    M->>B: Change notes and slots, tap Save Changes<br/>(disabled while no slot is picked)
    B->>W: updateBookingFn(bookingId, startTime, endTime, notes)
    W->>D: Read session, booking, its owner and its items
    alt no session, booking missing, other owner or cancelled
        W-->>B: "Not authenticated", "Booking not found",<br/>"Unauthorized" or "Cannot update a cancelled booking"
    end
    alt new start under 1 hour from now
        W-->>B: "Bookings must start at least 1 hour from now.<br/>Please select a later time slot."
    end
    loop each item calendar
        W->>C: Free/busy for the new window
        C-->>W: Busy periods
    end
    alt busy period outside the booking's own period
        W-->>B: "Requested time conflicts with existing<br/>booking for item name"
    end
    W->>D: Save new start, finish and notes
    W->>T: Post edited log to the channel<br/>(see telegram/channel-log.md)
    loop each item with an event
        W->>C: Update event to "item name - Booking"<br/>with new times and details
    end
    W-->>B: success
    B-->>M: Toast "Booking updated successfully!"
    B->>B: After 1.5 seconds go to My Bookings
    alt any error
        B-->>M: Toast with the error text or<br/>"Failed to update booking. Please try again."
    end
```
