# Extend a booking

## What does "Add 30 min" do?

```mermaid
sequenceDiagram
    autonumber
    participant P as Owner or admin
    participant B as Browser
    participant W as Worker
    participant C as Google Calendar
    participant D as D1
    P->>B: Click Add 30 min
    alt End plus 30 min passes midnight or the closing time (club time)
        B-->>P: Dialog "This booking can't be extended"
    else Allowed
        B-->>P: Confirm "Extend this booking by 30 minutes?"
    end
    P->>B: Confirm
    B->>W: extendBookingFn(bookingId)
    W->>W: Owner or admin or manager, status not cancelled or returned, same limits again
    W->>C: Free/busy for each live item from the old end to the new end
    alt Any item busy
        W-->>B: "Cannot extend the booking: NAMES is not available for the extra 30 minutes"
    else Free
        W->>D: End time plus 30 min
        opt New end is in the future and items are overdue
            W->>D: Overdue items back to active, owner's overdue count minus 1
        end
        W->>D: Recompute booking status
        W->>C: Update each live item's event title and end
        W-->>B: OK
        B-->>P: Toast "Booking extended by 30 minutes"
    end
```

- The button shows for booked, active, partially returned and overdue bookings, on the details page, the edit page and the expanded list rows. It can be used repeatedly.
- The availability check runs only on confirm, and only for the extra 30 minutes.
- If the new end is still in the past, the booking stays overdue and the count is unchanged (overdue forgiveness, see [GLOSSARY](../../../../GLOSSARY.md)). The count never drops below 0. The clock marks bookings overdue, see [every 5 minutes](../../cron/every-5-min.md).
- The channel gets an "extended" post.
