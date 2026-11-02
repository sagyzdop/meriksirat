# Data used by the album and housekeeping cron steps

> **Question:** Which tables and stored values do the album expiry,
> public notice, photo backfill, bot menu and stale signup steps
> read or write?
>
> **Answer:** They work on the album, photo and volume tables, the
> owners and co-authors in user and album_member, and the sign-in
> tables when deleting stale signups. The bot menu step touches no
> table. Only listed columns are used by these steps.
>
> **Notes:**
> - KV `photo-backfill:budget` holds JSON with the UTC day and the
>   writes spent that day. It expires after 2 days.
> - KV `album:list:DRIVE_FOLDER_ID` and `album:detail:ALBUM_ID` are
>   album page caches. Expiry deletes both keys when it removes an
>   album.
> - R2 is not used by these steps.
> - Tables booking, favorite, flamekeeper and flamekeeper_grant are
>   only checked to see if a stale signup owns something, so only
>   their user link is shown.

```mermaid
erDiagram
    user ||--o{ album : owns
    user ||--o{ album_member : joins
    album ||--o{ album_member : has
    album ||--o{ photo : holds
    album ||--o{ volume : has
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
        text telegramChatId "null means no Telegram"
        text role "user, manager, admin"
        boolean isMember
        timestamp bannedAt
        timestamp createdAt
        integer albumCount
    }
    album {
        text id PK
        text ownerUserId FK
        text title
        text driveFolderId
        text coverFileId
        integer photoCount
        integer photoBytes
        integer favoriteCount
        timestamp photosIndexedAt
        timestamp photosIndexRequestedAt
        text photosIndexSkipped "trashed, missing"
        timestamp expiresAt
        boolean pinned
        text tombstoneReason "expired, flamekeeper_left, flamekeeper_lost, no_space"
        timestamp deletedAt
        timestamp expiryReminder30SentAt
        timestamp expiryReminder7SentAt
        timestamp publicNoticePendingAt
        timestamp eventDate
        timestamp createdAt
    }
    album_member {
        text albumId FK
        text userId FK
    }
    photo {
        text id PK
        text albumId FK
        text driveFileId
        integer bytes
        text flamekeeperUserId "null means master account"
        text state "live, moving, deleted, dropped"
    }
    volume {
        text albumId PK
        text flamekeeperUserId PK
        text driveFolderId
    }
    session {
        text id PK
        text userId FK
    }
    account {
        text id PK
        text userId FK
    }
    booking {
        text userId FK
    }
    favorite {
        text userId FK
    }
    flamekeeper {
        text userId PK
    }
    flamekeeper_grant {
        text userId PK
    }
```
