# Tables used by the flamekeeper cron steps

> **Question:** Which tables and columns do the flamekeeper cron
> steps read and write?
>
> **Answer:** The steps work on the flamekeeper, its Drive
> grant, and the global settings row. The volume table is no longer read by these steps (#24), and
> the photo and upload reservation tables no longer exist (#25). They
> also read users (email, Telegram chat, ban) and, for banned
> members, bookings, booking items and the equipment calendar
> each item was booked on.
>
> **Notes:**
> - KV keys album:list:(album Drive folder id), TTL 8 days
>   seconds, and album:detail:(album id), TTL 3600 seconds,
>   are only deleted by these steps, never written.
> - R2 is not used by these steps.
> - The drain deadline, reason and reminder columns and health_cursor
>   were removed in #25.

```mermaid
erDiagram
    user ||--o| flamekeeper : is
    user ||--o| flamekeeper_grant : has
    user ||--o{ album : owns
    user ||--o{ booking : makes
    booking ||--o{ booking_item : contains
    equipment ||--o{ booking_item : booked_as
    album ||--o{ volume : stored_in
    flamekeeper ||--o{ volume : hosts

    user {
        text id PK
        text email
        text name
        text first_name
        text telegram_chat_id
        text role "user, manager, admin"
        integer banned_at
        integer album_count
    }
    flamekeeper {
        text user_id PK "FK user"
        integer pledged_bytes
        integer used_bytes
        integer drive_usage_bytes
        integer drive_usage_checked_at
        text state "active, full, draining, lost, drained"
        integer graduation_confirmed_at
        integer graduation_prompt_sent_at
        integer lost_since
        integer lost_notified_at
        integer lost_finalized_at
        integer health_checked_at
        integer created_at
    }
    flamekeeper_grant {
        text user_id PK "FK user"
        text refresh_token
        integer last_refresh_at
    }
    volume {
        text album_id PK "FK album"
        text flamekeeper_user_id PK "FK user"
        text permission_id
        text drive_folder_id
        integer dropped_at
    }
    album {
        text id PK
        text owner_user_id FK
        text title
        text drive_folder_id
        text cover_file_id
        integer photo_count
        integer photo_bytes
        integer favorite_count
        integer expires_at
        integer pinned
        text tombstone_reason "expired, flamekeeper_left, flamekeeper_lost, no_space, folder_deleted"
        integer deleted_at
    }
    settings {
        text id PK
        integer flamekeeper_cap_bytes
        integer pool_low_alerted_at
    }
    booking {
        integer id PK
        text user_id FK
        text status "booked, active, returned, cancelled, overdue, partially_returned"
    }
    equipment {
        integer id PK
        text gcal_id "equipment calendar"
    }
    booking_item {
        integer id PK
        integer booking_id FK
        integer equipment_id FK
        text status "booked, active, returned, cancelled, overdue"
        text gcal_event_id
    }
```
