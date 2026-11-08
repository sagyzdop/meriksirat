# Admin Data

> **Question:** Which tables and stored values do the admin scenarios read or write?
>
> **Answer:** The admin console works mostly on the user, settings, category and equipment tables. It reads bookings, albums, favorites and flamekeeper rows for counts, lists, the Free up space list and ban follow-up work, and deletes sessions when a person is banned or set to Inactive. Banning also changes the flamekeeper and volume rows through the steps in [ban-member.md](ban-member.md) and [../cron/flamekeepers/ban-cleanup.md](../cron/flamekeepers/ban-cleanup.md).
>
> **Notes:**
>
> - KV: the key album:list:{driveFolderId} holds the album's listings and folder state (ok, trashed or missing) with a TTL of 8 days. The dashboard only reads it, and never writes it.
> - R2: equipment images are stored under equipment-images/{equipmentId}-{time in ms}.{jpeg, png or webp}. They have no expiry, and replaced images are not removed.
> - The settings table has one row, with id global. It also holds the flamekeeper cap and the Pool-low alert percent, set in Settings, Storage, see [../flamekeepers/admin-pool.md](../flamekeepers/admin-pool.md).
> - Only the columns these scenarios use are listed.

```mermaid
erDiagram
    user {
        text id PK
        text name
        text email
        text first_name
        text last_name
        text birthday "ISO timestamp or YYYY-MM-DD"
        integer wants_birthday_congratulation
        text status "Active, Inactive, Alumni"
        integer clearance_level
        text role "user, manager, admin"
        integer is_member
        text telegram_chat_id
        text telegram_username
        text instagram_username
        integer nu_id
        text major
        text graduation_date "YYYY-MM-01, month precision"
        integer banned_at
        text ban_reason
        text banned_by
        integer cancelled_in_start_window_count
        integer overdue_count
        integer album_count
        integer created_at
    }
    session {
        text id PK
        text user_id FK
    }
    settings {
        text id PK "always global"
        text global_booking_note
        text club_code
        integer flamekeeper_cap_bytes
        text birthdays_calendar_id
        integer operating_hours_start "minutes 0 to 1439"
        integer operating_hours_end "minutes 0 to 1439"
    }
    category {
        integer id PK
        text name "unique"
        text description
        integer sort_order
    }
    equipment {
        integer id PK
        text model_name
        text short_name
        text description
        integer category_id FK
        text gcal_id "unique"
        integer required_clearance_level
        text image_path
        integer is_active
    }
    booking {
        integer id PK
        text user_id FK
        integer start_time
        text status "booked, active, returned, cancelled, overdue, partially_returned"
    }
    booking_item {
        integer id PK
        integer booking_id FK
        integer equipment_id FK
        text status "booked, active, returned, cancelled, overdue"
    }
    album {
        text id PK
        text owner_user_id FK
        text title
        text event
        integer event_date
        text cover_file_id
        text drive_folder_id
        integer photo_count
        integer photo_bytes
        integer favorite_count
        integer expires_at
        integer pinned
        integer rescued_at "status Rescued"
        integer scheduled_deletion_at "status Scheduled for deletion"
        text tombstone_reason "Lost when flamekeeper_lost, flamekeeper_left or folder_deleted"
        integer expiry_reminder_30_sent_at
        integer expiry_reminder_7_sent_at
        integer deleted_at
        integer created_at
    }
    album_member {
        text id PK
        text album_id FK
        text user_id FK
    }
    flamekeeper {
        text user_id PK,FK
        text state "active, full, draining, lost, drained"
    }
    volume {
        text id PK
        text album_id FK
        text flamekeeper_user_id FK "NULL means the buffer holds it"
        text drive_folder_id "at most 256 MB, several per holder per album"
        integer dropped_at
    }
    favorite {
        text user_id PK,FK
        text album_id PK,FK
        text drive_file_id PK
    }
    user ||--o{ session : has
    user ||--o{ booking : makes
    booking ||--o{ booking_item : contains
    equipment ||--o{ booking_item : booked_as
    category ||--o{ equipment : groups
    user ||--o{ album : owns
    album ||--o{ album_member : has
    user ||--o{ album_member : co_authors
    user ||--o| flamekeeper : may_be
    user ||--o{ volume : holds
    album ||--o{ favorite : favorited_as
    user ||--o{ favorite : makes
    album ||--o{ volume : stored_in
```
