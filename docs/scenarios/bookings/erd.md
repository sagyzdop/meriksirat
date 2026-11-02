# Booking tables

> **Question:** Which tables do the booking scenarios read and
> write?
>
> **Answer:** A booking belongs to one member and holds one booking
> item per piece of equipment. Each item points to an equipment row,
> which points to a category and has its own Google calendar. A
> single settings row holds the operating hours and the Global
> Booking Note. The booking status is derived from the item
> statuses.
>
> **Notes:**
> - No KV or R2 data is used by these scenarios. Equipment images
>   are shown from R2 by the equipment folder.
> - The rate limits (10 per 60 seconds for creating a booking and
>   for adding items) use Cloudflare rate limit bindings, not KV
>   or D1.
> - The settings row has id global and is created with hours 0 to
>   1439 if it is missing when the hours are first read.
> - Dates are stored as millisecond timestamps.
> - Item status has no partially_returned value. That booking
>   status is derived.

```mermaid
erDiagram
    user ||--o{ booking : makes
    booking ||--|{ booking_item : contains
    equipment ||--o{ booking_item : "booked as"
    category ||--o{ equipment : groups
    user {
        text id PK
        text first_name
        text last_name
        text name
        text telegram_username
        text telegram_chat_id
        integer overdue_count "lowered by 1 when an extension clears overdue"
        text role "user, manager, admin"
        integer is_member "needed to book"
    }
    booking {
        integer id PK
        text user_id FK
        integer start_time
        integer end_time "moved by 30 minutes on extend"
        text status "booked, active, returned, cancelled, overdue, partially_returned"
        text user_event_details "notes"
        integer started_at "actual pickup time"
        integer created_at
        integer updated_at
    }
    booking_item {
        integer id PK
        integer booking_id FK
        integer equipment_id FK
        text status "booked, active, returned, cancelled, overdue"
        text gcal_event_id "event in the equipment calendar"
        integer returned_at
    }
    equipment {
        integer id PK
        text model_name
        integer category_id FK
        text gcal_id "equipment calendar id"
        text image_path
    }
    category {
        integer id PK
        text name
    }
    settings {
        text id PK "always global"
        text global_booking_note "sent to member at pickup"
        integer operating_hours_start "minutes since midnight"
        integer operating_hours_end "minutes since midnight"
    }
```
