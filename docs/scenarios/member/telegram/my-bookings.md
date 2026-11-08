# My bookings in Telegram

Related: [start booking](start-booking.md), [cancel](cancel-booking.md), [return](return-equipment.md), [bookings on the web](../bookings/).

## What does My Bookings show?

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant W as Worker
    participant D as D1
    participant T as Telegram
    M->>W: "📋 My Bookings" or /my_bookings
    W->>D: Linked user by chat id
    alt Chat not linked
        W->>T: "Please link your account via /start first."
    else Linked
        W->>D: Bookings with an item booked, active or overdue
        alt None
            W->>T: "You have no active or upcoming bookings."
        else Some
            W->>T: Per booking: label (Upcoming, Active, Overdue, Partially Returned), id, date, club-time range, each item with its status
        end
    end
```

Read-only, no step is saved. A partly returned booking appears through its items that are still out.
