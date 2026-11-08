# ERD: albums and storage

Which tables hold albums, who holds their photos, and who can edit or favorite them? Source: `src/db/schema.ts`. Statuses are derived, not stored ([ADR-0018](../../adr/0018-album-status-is-derived-with-six-statuses.md)).

```mermaid
erDiagram
    user ||--o{ album : owns
    album ||--o{ volume : "photos held in"
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

- A volume holds at most 256 MB. Rows with no `flamekeeperUserId` are the buffer's; flamekeeper rows appear only after an offload (or on legacy data) and keep `expected*` NULL.
- `volume.flamekeeperUserId` points at `user`, not at the `flamekeeper` table.
- `album_member` is unique on `(albumId, userId)`: a user who opens the edit link becomes a co-author.
- `favorite` stores a Drive file id, not a photo row; photos exist only in Drive. When a file moves to another account, favorites are remapped.
- `photoCount` and `photoBytes` are totals synced from the listing cache ([album-listing](../kv/album-listing.md)).
- Deleting an album cascades to volumes, members and favorites.
