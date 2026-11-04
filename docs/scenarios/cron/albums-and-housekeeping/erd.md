# Data used by the album and housekeeping cron steps

> **Question:** Which tables and stored values do the album expiry,
> photo backfill and bot menu steps read or write?
>
> **Answer:** They work on the album, photo and volume tables, the
> owners and co-authors in user and album_member. Early expiry also reads
> favorite. Deleting an expired album reads buffer_volume, volume,
> flamekeeper and flamekeeper_grant to find each volume's owner, and
> no longer reads photo to decide what to delete. The bot menu step touches no table, only a KV marker. Only the
> columns these steps use are listed.
>
> **Notes:**
> - KV `photo-backfill:budget` holds JSON with the UTC day and the
>   writes spent that day. It expires after 2 days.
> - KV `album:list:DRIVE_FOLDER_ID` and `album:detail:ALBUM_ID` are
>   album page caches. Expiry deletes both keys when it removes an
>   album. Their own lifetimes are set in the albums folder, not by
>   these steps.
> - R2 is not used by these steps.
> - Column names are the database names.
> - album_member also has its own id and created_at, not used here.
> - The photo state is read, not changed, by these steps.

```mermaid
erDiagram
    user ||--o{ album : owns
    user ||--o{ album_member : joins
    album ||--o{ album_member : has
    album ||--o{ photo : holds
    album ||--o{ volume : has
    album ||--o{ upload_reservation : has
    photo ||--o{ favorite : "is favorited by"
    user ||--o{ volume : stores
    user ||--o{ upload_reservation : makes
    user ||--o{ session : has
    user ||--o{ account : has
    user ||--o{ booking : makes
    user ||--o{ favorite : makes
    user ||--o| flamekeeper : is
    user ||--o| flamekeeper_grant : has
    user {
        text id PK
        text email
        text telegram_chat_id "null means no Telegram"
        text role "user, manager, admin"
        integer is_member "boolean"
        integer banned_at
        integer created_at
        integer album_count
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
        integer photos_indexed_at
        integer photos_index_requested_at
        text photos_index_skipped "trashed, missing"
        integer expires_at
        integer pinned "boolean"
        text tombstone_reason "expired, flamekeeper_left, flamekeeper_lost, no_space, folder_deleted"
        integer deleted_at
        integer expiry_reminder_30_sent_at
        integer expiry_reminder_7_sent_at
        integer event_date
        integer created_at
        integer updated_at
    }
    album_member {
        text album_id FK
        text user_id FK
    }
    photo {
        text id PK
        text album_id FK
        text drive_file_id
        integer bytes
        text flamekeeper_user_id "null means master account"
        text state "live, moving, deleted, dropped"
    }
    favorite {
        text user_id PK
        text photo_id PK
    }
    volume {
        text album_id PK
        text flamekeeper_user_id PK
        text drive_folder_id
    }
    upload_reservation {
        text id PK
        text album_id FK
        text flamekeeper_user_id FK
        integer expires_at
    }
    session {
        text id PK
        text user_id FK
    }
    account {
        text id PK
        text user_id FK
    }
    booking {
        integer id PK
        text user_id FK
    }
    flamekeeper {
        text user_id PK
    }
    flamekeeper_grant {
        text user_id PK
    }
```
