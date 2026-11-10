# Album warnings

Related: [refresh](refresh.md), [GLOSSARY: Folder state](../../../../GLOSSARY.md), [admin albums](../../admin/albums/).

## What happens when the album's Drive folder is in the bin or deleted?

```mermaid
sequenceDiagram
    autonumber
    actor O as Owner or album manager
    actor A as Admin
    participant W as Worker
    participant G as Master Drive
    participant D as D1
    Note over W,G: A listing finds the folder in the bin or gone
    W-->>O: Warning with an Open in Google Drive link, uploads paused
    A->>W: Delete album on the warning, confirm
    W->>G: Folder state
    alt Folder exists, is in the bin, or the check failed
        W-->>A: Error, nothing changes
    else Confirmed deleted
        W->>D: Tombstone (reason folder_deleted), counts 0, favorites and volume rows dropped, owner albumCount - 1
        W-->>A: Toast "Album deleted"
    end
```

- The app never restores or recreates a folder. An owner can take a binned folder out of the bin in Drive.
- Only admins get the button, not managers. Nothing is deleted in Drive, files in flamekeepers' Drives are left alone.
- The state is noticed when the hourly reconcile next checks the album (it works through all albums in about two weeks), when a view has to list Drive (after 7 days at most), or on Refresh.

## What does "Fewer photos than expected" mean?

```mermaid
sequenceDiagram
    autonumber
    actor O as Owner or admin
    participant W as Worker
    participant G as Drive
    participant D as D1
    Note over W: A buffer Volume lists fewer photos or bytes than its expected values
    W-->>O: Warning with found and expected counts and an Accept button
    O->>W: acceptFewerPhotosFn(albumId, volumeKey)
    W->>G: List the album again
    alt Listing incomplete or nothing to accept
        W-->>O: Error, nothing changed
    else Complete
        W->>D: expected count and bytes = lower of current and listed
        W-->>O: Toast "New photo count accepted"
    end
```

- Only buffer Volumes warn, and only from a complete, fresh listing with a healthy folder. Photos added by hand in Drive never raise it.
- Accept re-lists on the Worker and ignores files created in the last 10 minutes, so a late confirm cannot be undone. The values only go down.
- Admins also see the Volume's Drive link and holder.
