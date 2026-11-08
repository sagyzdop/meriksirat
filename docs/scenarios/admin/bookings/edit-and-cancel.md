# Edit and cancel a booking (admin)

Both go through `updateBookingStatusAdminFn`. Unlike members, admins have no advance-notice, 48-hour, 60-day or operating-hours limits.

## How does an admin edit a booking?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI as /admin/bookings/:id/edit
    participant W as Worker
    participant Cal as Equipment calendars
    participant TG as Audit channel

    A->>UI: change notes, and slots while status is booked
    UI->>W: bookingId, notes, start/end (only if changed)
    opt times changed
        W->>Cal: free/busy for every item, ignoring this booking's own events
        alt conflict
            W-->>UI: "Requested time conflicts with existing booking for ..."
        end
    end
    W->>W: save notes and times, recompute status
    W->>TG: "edited" log naming the admin
    W->>Cal: update every item's event (errors logged only)
    W-->>UI: success, back to the list
```

- On the same page the admin can add equipment or cancel a single item, only while the booking is `booked`.
- Notes replace the old notes; blank clears them.

## How does an admin cancel a booking?

```mermaid
flowchart TD
    C["Cancel on details or list row"] --> S{"Status is booked?"}
    S -->|"no"| X["Refused: must be returned via the Telegram bot"]
    S -->|"yes"| A["Optional admin note appended to the member's notes"]
    A --> I["All items set to cancelled, booking status recomputed"]
    I --> L["'cancelled' log naming the admin"]
    L --> E["Calendar events deleted"]
```

- Calendar and log failures are logged and do not undo the cancellation.
- Any other target status is rejected.
