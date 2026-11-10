# Refresh an album

Related: [warnings](warnings.md), [ADR-0017](../../../adr/0017-drop-photo-table-read-from-drive.md).

## What does Refresh do?

Albums are read from cached Drive listings, not from a table of photo rows. Refresh forces a new read of every volume.

```mermaid
sequenceDiagram
    autonumber
    actor M as Owner, co-author or album manager
    participant W as Worker
    participant K as D1 album_listing rows
    participant D as D1
    participant G as Drive
    M->>W: refreshAlbumFn(albumId)
    alt No role on the album
        W-->>M: Error Insufficient permissions
    else Over 10 requests a minute per user
        W-->>M: Error Too many refresh requests
    else Allowed
        W->>D: Read authors and co-authors
        W->>G: Folder state, then list each volume with its holder's token
        W->>K: Rewrite the album_listing rows that changed
        W-->>M: Fresh album, toast "Album refreshed"
    end
```

- A volume that fails to list keeps its last good listing, so Refresh never empties an album because Drive had a bad moment.
- The page shows the returned album directly, so warnings appear even if storing the rows fails.
- Not needed after an upload. It picks up changes made outside the app before the hourly reconcile reaches the album, which can take up to two weeks, or a view lists it after 7 days.
- Folder health (ok, in the bin, deleted) is re-checked each time, see [warnings](warnings.md).
