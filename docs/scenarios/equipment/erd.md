# Equipment data model

> **Question:** Which tables and stored data do the equipment and
> favorites scenarios use?
>
> **Answer:** Browsing reads equipment and category rows, limited by
> the member's clearance level on the user row, plus the operating
> hours in the settings row. Favorites read and write favorite rows
> and the favorite count on the album, and can add photo rows.
> Equipment images live in R2. No KV data is used.
>
> **Notes:**
> - R2 bucket binding `meriksirat_r2`: key pattern
>   `equipment-images/{equipmentId}-{timestamp}.{ext}` as written by
>   the admin upload, with no expiry. The comment in the schema
>   shows an older pattern, `equipment-images/{id}.jpg`.
> - KV is not used. The image rate limit is a Cloudflare rate limit
>   binding of 300 requests per 60 seconds, not stored data.
> - Google free/busy and event data is read live from Google
>   Calendar and is not stored in D1.
> - The Google calendar id of each equipment (`gcal_id`) is unique.
> - A missing or zero clearance level counts as 1. The settings row
>   with id `global` is created with defaults when it is missing.
> - The sidebar also reads role and is_member from the user row.

```mermaid
erDiagram
    user ||--o{ favorite : makes
    photo ||--o{ favorite : receives
    album ||--o{ photo : contains
    category ||--o{ equipment : groups
    user {
        text id PK
        text role "user, manager, admin"
        integer is_member
        integer clearance_level "default 1"
        integer banned_at "set when banned"
    }
    category {
        integer id PK
        text name
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
        text image_path "R2 key"
        integer is_active
    }
    settings {
        text id PK "global"
        integer operating_hours_start "minutes, default 0"
        integer operating_hours_end "minutes, default 1439"
    }
    album {
        text id PK
        text title
        text drive_folder_id
        integer favorite_count
        integer photos_indexed_at
    }
    photo {
        text id PK
        text album_id FK
        text drive_file_id
        text state "live, moving, deleted, dropped"
    }
    favorite {
        text user_id PK "FK to user"
        text photo_id PK "FK to photo"
        integer created_at
    }
```
