# ERD: albums and storage

Which tables hold albums, who holds their photos, and who can edit or favorite them? Source: `src/db/schema.ts`. Statuses are derived, not stored ([ADR-0018](../../adr/0018-album-status-is-derived-with-six-statuses.md)).

```mermaid
erDiagram
    user ||--o{ album : owns
    album ||--o{ volume : "photos held in"
    album ||--o{ photo_source : "listed from"
    album ||--o{ photo : shows
    user ||--o{ volume : "holds as flamekeeper"
    album ||--o{ album_member : "edited by"
    user ||--o{ album_member : joins
    album ||--o{ favorite : "photo favorited in"
    user ||--o{ favorite : makes
    album {
        text id PK
        text ownerUserId FK
        text title
        text driveFolderId UK
        text coverFileId
        int photoCount
        int photoBytes
        int favoriteCount
        text editShareToken UK
        ts eventDate
        ts scheduledDeletionAt
        ts deletedAt
        text tombstoneReason "folder_deleted, flamekeeper_left, flamekeeper_lost"
        ts rescuedAt
        text folderState "ok, trashed, missing"
        ts photosCheckedAt
    }
    photo_source {
        text albumId PK, FK
        text key PK "buffer:id, flamekeeper:id, master"
        text folderId
        text stamp
        text status
        int listedAt
        int failedAt
    }
    photo {
        text albumId PK, FK
        text sourceKey PK
        text fileId PK
        int size
        text md5
        text meta "Drive file as listed, JSON"
    }
    volume {
        text id PK
        text albumId FK
        text flamekeeperUserId FK "NULL means buffer"
        text permissionId
        text driveFolderId
        ts droppedAt
        int expectedCount
        int expectedBytes
        ts expectedChangedAt
    }
    album_member {
        text id PK
        text albumId FK
        text userId FK
    }
    favorite {
        text userId PK, FK
        text albumId PK, FK
        text driveFileId PK
    }
    user {
        text id PK
    }
```

- A volume holds at most 256 MB. Rows with no `flamekeeperUserId` are the buffer's; flamekeeper rows are created by an offload and carry `expected*` like the buffer's (legacy flamekeeper rows keep them NULL).
- A row with `droppedAt` set is not live: it is skipped by listings and the storage holder, and the cleanup of dropped volumes deletes what its folder still holds, then the row. Offloads and rescues stage their new volumes as dropped rows and make them live in one batch ([album-offload](../kv/album-offload.md)).
- `volume.flamekeeperUserId` points at `user`, not at the `flamekeeper` table.
- `album_member` is unique on `(albumId, userId)`: a user who opens the edit link becomes a co-author.
- `favorite` stores a Drive file id. A photo's identity is still its current Drive file id, so when a file moves to another account, favorites are remapped and the album's `photo` rows are rebuilt from Drive.
- `photo` and `photo_source` are what album pages read; uploads, deletes and listings of Drive keep them current ([album-listing](../kv/album-listing.md)). `photoCount` and `photoBytes` are totals synced from a complete listing.
- `album` is indexed on `(createdAt, id)`, the order the album lists page through, so a page reads about as many rows as it shows.
- Deleting an album cascades to volumes, members, favorites, photo sources and photos.
