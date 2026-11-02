# Booking cron data

> **Question:** Which tables do the booking cron steps read and write?
>
> **Answer:** They read and write bookings and booking items, read equipment (names and calendar ids) and read users (Telegram chat, ban status). They write the four reminder timestamps on the booking and two violation counters on the user.
>
> **Notes:**
> - No KV or R2 data is used by these steps.
> - Calendar events are not stored as rows. Each booking item keeps its event id in `gcal_event_id` and each equipment row keeps its calendar id in `gcal_id`.

```mermaid
erDiagram
    user ||--o{ booking : makes
    booking ||--|{ booking_item : contains
    equipment ||--o{ booking_item : "is booked in"
    user {
        text id PK
        text first_name
        text last_name
        text name
        text telegram_username
        text telegram_chat_id "no chat id means no messages"
        integer banned_at "set means banned"
        integer cancelled_in_start_window_count "plus 1 per auto-cancel"
        integer overdue_count "plus 1 per overdue booking"
    }
    booking {
        integer id PK
        text user_id FK
        integer start_time
        integer end_time
        text status "booked, active, returned, cancelled, overdue, partially_returned"
        text user_event_details
        integer started_at "pickup time"
        integer start_reminder_sent_at "pre_start"
        integer start_warning_sent_at "start_warning"
        integer return_reminder_sent_at "return_warning"
        integer grace_warning_sent_at "grace_5min"
    }
    booking_item {
        integer id PK
        integer booking_id FK
        integer equipment_id FK
        text status "booked, active, returned, cancelled, overdue"
        text gcal_event_id
    }
    equipment {
        integer id PK
        text model_name
        text short_name
        text gcal_id
    }
```
