# Data used by the album and housekeeping cron steps

> **Question:** Which tables and stored values do the album expiry
> and bot menu steps read or write?
>
> **Answer:** They work on the album and volume tables, the
> owners and co-authors in user and album_member. Early expiry also reads
> favorite. Deleting an expired album reads volume,
> flamekeeper and flamekeeper_grant to find each volume's owner, and
> reads Drive listings, not a photo table, to decide what to delete. The bot menu step touches no table, only a KV marker. Only the
> columns these steps use are listed.
>
> **Notes:**
> > - KV `album:list:DRIVE_FOLDER_ID` and `album:detail:ALBUM_ID` are
>   album page caches. Expiry deletes both keys when it removes an
>   album. Their own lifetimes are set in the albums folder, not by
>   these steps.
> - R2 is not used by these steps.
> - Column names are the database names.
> - album_member also has its own id and created_at, not used here.
> 
```mermaid
erDiagram
    user ||--o{ album : owns
    user ||--o{ album_member : joins
    album ||--o{ album_member : has
    album ||--o{ volume : has
    album ||--o{ favorite : "is favorited by"
    user ||--o{ volume : stores
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
    favorite {
        text user_id PK
        text album_id PK
        text drive_file_id PK
    }
    volume {
        text album_id PK
        text flamekeeper_user_id PK
        text drive_folder_id
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
