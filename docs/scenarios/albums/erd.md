# Album data

> **Question:** Which tables, KV keys and Drive folders do the album scenarios read and write?
>
> **Answer:** Albums are stored in the album table with their co-authors in album_member and their photos in photo. Photos stored by flamekeepers carry the flamekeeper's user id, and each album has one volume row per flamekeeper who stored photos in it. Upload reservations hold space for uploads in progress. Short-lived copies of album pages and lists sit in KV. No R2 storage is used for albums.
>
> **Notes:**
> - KV `album:detail:ALBUM_ID`: shared album page core (photos, authors, cover, folder health), TTL 3600 s, plus a 30 s per-Worker memory copy.
> - KV `album:list:FOLDER_ID`: Drive folder listing and health (ok, trashed, missing), TTL 300 s.
> - KV `album:publist:HASH`: one page of the public gallery, TTL 600 s, plus a 30 s per-Worker memory copy.
> - KV `photo-backfill:budget`: day and writes spent by the indexer, TTL 2 days.
> - Drive layout in the master account: Albums / year / month / album title, with a "Volume xxxxxx" folder inside for each flamekeeper. Photo files are owned by the flamekeeper who uploaded them. See create-album.md and upload-pick-flamekeeper.md.
> - Photo state values other than live (moving, deleted, dropped) belong to the flamekeeper moves, see flamekeepers/.
> - The ids: album id 10 characters, edit token 24 characters, reservation id 16 characters.

```mermaid
erDiagram
    user ||--o{ album : owns
    user ||--o{ album_member : joins
    album ||--o{ album_member : has
    album ||--o{ photo : contains
    album ||--o{ volume : has
    album ||--o{ upload_reservation : holds
    user ||--o{ volume : stores
    user ||--o{ upload_reservation : reserves
    user ||--o| flamekeeper : is
    user {
        text id PK
        integer albumCount "albums owned or co-authored"
        integer clearanceLevel "3 or more may create albums"
        text role "user, manager, admin"
    }
    album {
        text id PK
        text ownerUserId FK
        text title
        text description
        text event
        integer eventDate
        text driveFolderId "unique, master Drive folder"
        text coverFileId
        integer photoCount
        integer photoBytes
        integer favoriteCount
        integer photosIndexedAt "empty means legacy album"
        integer photosIndexRequestedAt
        text photosIndexSkipped "trashed, missing"
        integer expiresAt
        integer pinned
        text tombstoneReason "expired, flamekeeper_left, flamekeeper_lost, no_space"
        integer deletedAt
        integer expiryReminder30SentAt
        integer expiryReminder7SentAt
        text editShareToken "unique"
        integer publicNoticePendingAt
    }
    album_member {
        text id PK
        text albumId FK
        text userId FK
    }
    photo {
        text id PK
        text albumId FK
        text driveFileId "unique"
        text name
        integer bytes
        text mimeType
        text flamekeeperUserId "empty for master-owned files"
        text state "live, moving, deleted, dropped"
    }
    volume {
        text albumId PK, FK
        text flamekeeperUserId PK, FK
        text permissionId
        text driveFolderId "Volume folder in the album folder"
    }
    upload_reservation {
        text id PK
        text flamekeeperUserId FK
        text albumId FK
        integer bytes
        integer expiresAt "2 hours after creation"
    }
    flamekeeper {
        text userId PK
        integer pledgedBytes
        integer usedBytes
        integer driveUsageBytes
        text state "active, full, draining, lost, drained"
    }
```
