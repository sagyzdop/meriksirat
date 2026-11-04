# Album data

> **Question:** Which tables, KV keys and Drive folders do the album scenarios read and write?
>
> **Answer:** Albums are stored in the album table with their co-authors in album_member and their photos in photo. Favorites point at photos, and the settings row holds the per-flamekeeper storage cap. Photos held by the buffer carry the owner value `buffer`, and each album has one buffer_volume row with the expected photo count and bytes. Photos stored by flamekeepers before the buffer carry the flamekeeper's user id, with one volume row per flamekeeper. Upload reservations now only serve the browser relay. Short-lived copies of album pages and lists sit in KV. No R2 storage is used for albums.
>
> **Notes:**
> - KV `album:detail:ALBUM_ID`: shared album page core (photos, authors, cover, folder health), TTL 3600 s, plus a 30 s per-Worker memory copy.
> - KV `album:list:FOLDER_ID`: Drive folder listing and health (ok, trashed, missing), TTL 300 s.
> - KV `album:publist:HASH`: one page of the public gallery, TTL 600 s, plus a 30 s per-Worker memory copy.
> - KV `photo-backfill:budget`: day and writes spent by the indexer, TTL 2 days.
> - Drive layout in the master account: Albums / year / month / album title, with a "Volume xxxxxx" folder inside for the buffer, and for each flamekeeper who held photos before it. New photo files are owned by the buffer. See create-album.md and upload-to-buffer.md.
> - Photo state values other than live (moving, deleted, dropped) belong to the flamekeeper moves, see flamekeepers/.
> - The ids: album id 10 characters, edit token 24 characters, reservation id 16 characters, co-author link id 12 characters, photo id 16 characters.
> - Column names are the database names, for example album_count and clearance_level.
> - R2 is not used for albums. Cover and photo images come from Google's image servers.

```mermaid
erDiagram
    user ||--o{ album : owns
    user ||--o{ album_member : joins
    album ||--o{ album_member : has
    album ||--o{ photo : contains
    album ||--o{ volume : has
    album ||--o| buffer_volume : has
    album ||--o{ upload_reservation : holds
    photo ||--o{ favorite : has
    user ||--o{ favorite : makes
    user ||--o{ volume : stores
    user ||--o{ upload_reservation : reserves
    user ||--o| flamekeeper : is
    user {
        text id PK
        integer album_count "albums owned or co-authored"
        integer clearance_level "3 or more may create albums"
        text role "user, manager, admin"
        integer is_member "must be true to create albums"
        text telegram_chat_id "reminders go here"
    }
    album {
        text id PK
        text owner_user_id FK
        text title
        text description
        text event
        integer event_date
        text drive_folder_id "unique, master Drive folder"
        text cover_file_id
        integer photo_count
        integer photo_bytes
        integer favorite_count
        integer photos_indexed_at "empty means legacy album"
        integer photos_index_requested_at
        text photos_index_skipped "trashed, missing"
        integer expires_at
        integer pinned
        text tombstone_reason "expired, flamekeeper_left, flamekeeper_lost, no_space, folder_deleted"
        integer deleted_at
        integer expiry_reminder_30_sent_at
        integer expiry_reminder_7_sent_at
        text edit_share_token "unique"
        integer created_at "lists are sorted and grouped by this"
    }
    album_member {
        text id PK
        text album_id FK
        text user_id FK
    }
    photo {
        text id PK
        text album_id FK
        text drive_file_id "unique"
        text name
        integer bytes
        text mime_type
        text flamekeeper_user_id "empty for master-owned files"
        text state "live, moving, deleted, dropped"
        integer created_at "earliest one is the default cover"
    }
    favorite {
        text user_id PK, FK
        text photo_id PK, FK
    }
    buffer_volume {
        text album_id PK, FK
        text drive_folder_id "Volume folder in the album folder"
        text permission_id "empty until shared with the buffer"
        integer expected_count
        integer expected_bytes
    }
    volume {
        text album_id PK, FK
        text flamekeeper_user_id PK, FK
        text permission_id
        text drive_folder_id "Volume folder in the album folder"
        integer dropped_at
    }
    upload_reservation {
        text id PK
        text flamekeeper_user_id FK
        text album_id FK
        integer bytes
        integer expires_at "2 hours after creation"
    }
    flamekeeper {
        text user_id PK
        integer pledged_bytes
        integer used_bytes
        integer drive_usage_bytes
        text state "active, full, draining, lost, drained"
    }
    settings {
        text id PK "global"
        integer flamekeeper_cap_bytes "default 20 GB"
    }
```
