# Refresh an album

Related: [warnings](warnings.md), [ADR-0017](../../../adr/0017-drop-photo-table-read-from-drive.md).

## What does Refresh do?

Albums are read from cached Drive listings, not from a photo table. Refresh forces a new read of every volume.

```mermaid
sequenceDiagram
    autonumber
    actor M as Owner, co-author or album manager
    participant W as Worker
    participant K as D1 app_state
    participant D as D1
    participant G as Drive
    M->>W: refreshAlbumFn(albumId)
    alt No role on the album
        W-->>M: Error Insufficient permissions
    else Over 10 requests a minute per user
        W-->>M: Error Too many refresh requests
    else Allowed
        W->>K: Drop album:detail (core, TTL 6 hours)
        W->>D: Read authors and co-authors
        W->>G: Folder state, then list each volume with its holder's token
        W->>K: Overwrite album:list for each folder (TTL 8 days)
        W-->>M: Fresh album, toast "Album refreshed"
    end
```

- A volume that fails to list keeps its last good listing, so Refresh never empties an album because Drive had a bad moment.
- The page shows the returned album directly, so warnings appear even if the cache write is refused.
- Not needed after an upload. It picks up changes made outside the app before the listing is due again (listings are fresh for 12 hours).
- Folder health (ok, in the bin, deleted) is re-checked each time, see [warnings](warnings.md).
