# Equipment data model

> **Question:** Which tables and stored data do the equipment and
> favorites scenarios use?
>
> **Answer:** Browsing reads equipment and category rows, filtered by the
> member's clearance level on the user row. Favorites read and write
> favorite rows and the favorite count on the album, and may add photo
> rows. Equipment images live in R2, and no KV data is used.
>
> **Notes:**
> - R2 bucket binding `meriksirat_r2`: key pattern
>   `equipment-images/{equipmentId}-{timestamp}.{ext}` as written by the
>   admin upload, with no expiry. The column comment in the schema shows
>   an older pattern `equipment-images/{id}.jpg`.
> - KV is not used. The rate limiter for images is a Cloudflare rate
>   limit binding with 300 requests per 60 seconds, not stored data.
> - Google free/busy and event data is read live from Google Calendar and
>   is not stored in D1.
> - The Google calendar id of each equipment is unique.

```mermaid
erDiagram
    user ||--o{ favorite : makes
    photo ||--o{ favorite : receives
    album ||--o{ photo : contains
    category ||--o{ equipment : groups
    user {
        text id PK
        integer clearanceLevel "user clearance, 1 if missing"
        integer bannedAt "set when banned"
    }
    category {
        integer id PK
        text name
        text description
        integer sortOrder
    }
    equipment {
        integer id PK
        text modelName
        text shortName
        text description
        integer categoryId FK
        text googleCalendarId "gcal_id, unique"
        integer requiredClearanceLevel
        text imagePath "R2 key"
        integer isActive
    }
    album {
        text id PK
        text title
        text driveFolderId
        integer favoriteCount
        integer photosIndexedAt
    }
    photo {
        text id PK
        text albumId FK
        text driveFileId
        text state "live, moving, deleted, dropped"
    }
    favorite {
        text userId PK "FK to user"
        text photoId PK "FK to photo"
        integer createdAt
    }
```
