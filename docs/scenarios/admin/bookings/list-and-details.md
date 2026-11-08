# Bookings: list and details

Manage Bookings (`/admin/bookings`) lists every member's bookings. Statuses are derived ([Derived status](../../../../GLOSSARY.md)), so admins never set them directly.

## How do admins browse and open bookings?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI
    participant W as Worker
    participant D1

    A->>UI: filter by status and date range, sort, page
    UI->>W: getAdminBookingsFn
    W->>D1: bookings with member and items (status, start/end range, sort)
    W-->>UI: page of bookings
    A->>UI: open a booking
    UI->>W: getAdminBookingByIdFn
    W-->>UI: items, member, notes, times
    Note over UI: Edit and Cancel are offered only while status is booked
```

- Status filter uses booking statuses; date filters compare the booking's start and end.
- The details page is the shared booking view plus "booked by". Members' own view is in [member bookings](../../member/bookings/).
- Only `booked` bookings can change. Active, overdue and partly returned ones are returned through the Telegram bot ([ADR-0004](../../../adr/0004-returns-are-telegram-only.md)).
