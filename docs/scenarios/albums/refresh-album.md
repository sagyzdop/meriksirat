# Refresh an album

> **Question:** What does the Refresh button on an album page do?
>
> **Answer:** Refresh throws away the shared album core and lists every volume of the album in Drive again right away, so the person who pressed it and everyone after them see current data. It is available to the owner, co-authors and admins or managers, and each person can press it at most 10 times a minute. The page then shows the toast "Album refreshed".
>
> **Notes:**
> - Refresh re-checks the folder health in Drive (ok, in the bin, deleted), the authors and the file list of each volume. A volume that fails to list keeps its last listing, so Refresh never empties an album because Drive had a bad moment.
> - Refresh is not needed after an upload, see upload-send-and-confirm.md. It is the way to pick up changes made outside the app before the listing is due again.
> - Cache keys: KV `album:detail:ALBUM_ID` (1 hour) and `album:list:FOLDER_ID` (see [ADR-0017](../../adr/0017-drop-photo-table-read-from-drive.md)).
> - Who may use it is decided by albumContext, the same check used by most album actions: no session or no role gives "Insufficient permissions", and an unknown or deleted album gives "Album not found".

```mermaid
sequenceDiagram
    autonumber
    participant M as Owner, co-author or admin
    participant B as Browser
    participant W as Worker
    participant K as KV
    participant D as D1
    participant G as Drive
    M->>B: Click Refresh in the manage panel
    B->>W: refreshAlbumFn(albumId)
    W->>D: Load album and the caller's role
    alt Album missing or deleted
        W-->>B: Error Album not found
    else Caller has no role
        W-->>B: Error Insufficient permissions
    else Caller may refresh
        W->>W: rl_refresh_album, 10 per 60 seconds per user
        alt Rate limited
            W-->>B: Error Too many refresh requests.<br/>Please try again shortly.
        else Allowed
            W->>K: Delete album:detail:albumId
            W->>D: Read authors and co-authors
            W->>K: Save new core, TTL 3600 seconds
            W->>G: Master token: folder state
            W->>G: Each volume's owner token: list its folder
            W->>K: Overwrite album:list:folderId, TTL 8 days
            W-->>B: Fresh album
            B->>M: Toast "Album refreshed"
            B->>B: Invalidate albums queries and reload the page data
        end
    end
    opt Any error
        B->>M: Red toast with the message, or "Failed to refresh album"
    end
```
