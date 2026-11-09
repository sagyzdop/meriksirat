# Delete an album

Related: [warnings](warnings.md) for a folder that is already gone, [ADR-0012](../../../adr/0012-no-backup-albums-expire.md).

## What happens when the owner or an admin deletes an album?

Only the owner and album managers can. There is no backup.

```mermaid
sequenceDiagram
    autonumber
    actor M as Owner or album manager
    participant W as Worker
    participant F as Volume holders' Drives
    participant G as Master Drive
    participant D as D1
    participant T as Telegram
    M->>W: deleteAlbumFn(albumId), confirmed in the dialog
    W->>F: List each volume fresh with its holder's token, delete the files found
    alt Listing incomplete or some deletes failed, or the budget ran out
        W-->>M: Error "too large to delete in one go", try again to continue
    else Volumes emptied
        W->>G: Delete the album folder
        opt Folder still holds files the master cannot delete
            W->>T: Alert admins, folder kept
        end
        W->>D: Delete the album row (co-author links, favorites, volumes go with it), owner albumCount - 1
        W-->>M: Toast "Album deleted", go to My Albums
    end
```

- What is left in Drive is the progress, so a retry continues where the last run stopped. Nothing is stored between attempts.
- Files of a flamekeeper whose Google connection is lost cannot be listed or deleted. They are left and the album row is still removed.
- Only the owner's album count drops. Co-authors' counts do not change.
- A scheduled deletion runs this same removal from the hourly cron and also removes the row. A tombstone is kept only for a folder that is permanently gone, see [cron](../../cron/).
