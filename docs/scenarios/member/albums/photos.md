# Cover, delete and download photos

Related: [refresh](refresh.md), [ADR-0017](../../../adr/0017-drop-photo-table-read-from-drive.md).

## How does someone set the cover or delete a photo?

The owner, co-authors and album managers can do both from the photo viewer. Both are checked against the album's own listing.

```mermaid
sequenceDiagram
    autonumber
    actor M as Owner, co-author or album manager
    participant W as Worker
    participant K as KV
    participant D as D1
    participant G as Drive
    M->>W: setCoverPhotoFn or deletePhotoFn(albumId, fileId)
    W->>K: Find the file in the album listing (refresh once if missing)
    alt Not listed
        W-->>M: Error Photo not found in this album
    else Set cover
        W->>D: coverFileId = fileId
        W-->>M: Toast "Cover photo updated"
    else Delete
        W->>G: Delete with the token of whoever holds the file (buffer, flamekeeper or master)
        W->>D: Photo count and bytes down, favorites of the file removed, expected count and bytes of a buffer Volume down, cover cleared if it was this photo
        W-->>M: Toast "Photo deleted"
    end
```

- A file that is not in this album's folders is never touched, so a cover or delete cannot reach another album. The caller's own Google token is never used.
- If the holder's token cannot be used, the error is shown and nothing changes.
- With no cover chosen, the earliest uploaded photo is used and saved at the first complete listing.

## How does a visitor download?

```mermaid
flowchart LR
    A["Photo viewer, Download"] --> B["Browser opens drive.usercontent.google.com download link, full-size original, no token"]
    C["Album header, Download (shown when the album has photos)"] --> D["Opens the folder in Google Drive in a new tab"]
    D --> E["Visitor uses Drive's own Download button for a zip"]
```

Every album folder is readable by anyone with the link, so the Worker is not involved. Google offers anonymous visitors no zip of a folder, so the folder link is the only whole-album download. There is no backup, see [ADR-0012](../../../adr/0012-no-backup-albums-expire.md).
