# My Bookings and booking details

## What does My Bookings show?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    M->>B: Open /bookings
    B->>B: No status filter chosen, use booked, active, overdue, partially returned
    B->>W: getUserBookingsFn(filters, page, limit 50, sort)
    W->>D: This member's bookings, then their items with equipment and category
    W-->>B: Bookings and page info
    B-->>M: List with row actions
    M->>B: Change sort, status, dates or page
    B->>B: Update the URL and load again
```

- Returned and cancelled bookings show only when chosen in the status filter. Sort, status, date range and page live in the URL. A date range uses the browser's time zone.
- Sort options: start time (default, oldest first), end time, status, created time, equipment name. The page has a Booking Time button for start time.
- A failed load shows an empty list.
- Row actions lead to the pages below and to [edit](edit.md) and [cancel](cancel.md).

## What does a booking's page show?

```mermaid
flowchart TD
    A["Open /bookings/id"] --> B{"Own booking with items?"}
    B -->|"No"| C["Booking not found"]
    B -->|"Yes"| D["Details, equipment with per-item action, notes"]
    D --> E{"Status"}
    E -->|"booked"| F["Edit, Cancel, Add More, Cancel item, Add 30 min"]
    F --> G{"Inside the start window and not started?"}
    G -->|"Yes"| H["Also Start Pickup"]
    E -->|"active, partially returned, overdue"| I["Return (opens bot), Add 30 min"]
    E -->|"returned, cancelled"| J["Details only"]
```

- Actions: [edit and add items](edit.md), [extend](extend.md), [cancel](cancel.md), [pickup and return](pickup-and-return.md).
- Returning needs the bot username from the environment, otherwise no Return button.
- The admin version of this page is under admin bookings.
