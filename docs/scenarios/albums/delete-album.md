# Delete an album

> **Question:** What happens when the owner or an admin deletes an album?
>
> **Answer:** Only the owner or an admin or manager can delete. The Worker first deletes the photos held in flamekeepers' Drives, using each flamekeeper's own token, then deletes the album folder with the master token, then removes the album row and lowers the owner's album count. The page shows "Album deleted" and returns to My Albums. A very large album (over 2000 flamekeeper photos) is deleted in rounds and the member is told to try again. If some photos or folders cannot be cleared, the folder is kept and the person sees an error or admins get a Telegram alert.
>
> **Notes:**
> - There is no backup. The dialog says this permanently deletes the album, all its photos from Google Drive, and removes all co-authors.
> - Deleting by hand removes the row completely. Expiry (cron) keeps a tombstone row instead, see cron/albums-and-housekeeping/.
> - Volumes that the master account cannot delete are cleared by the healing step described in flamekeepers/ and cron/flamekeepers/.
> - If a flamekeeper's grant is lost, their photos are dropped from the table and the Drive folder is kept so nothing is left half deleted.
> - If Drive refuses to delete the folder for another reason, the failure is only logged and the album row is still removed.

```mermaid
sequenceDiagram
    autonumber
    participant M as Owner or admin
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant F as Flamekeeper Drive
    participant G as Master Drive
    participant T as Telegram
    M->>B: Click Delete album, confirm in the dialog
    B->>W: deleteAlbumFn(albumId)
    W->>D: Load album and the caller's role
    alt Album missing or deleted
        W-->>B: Error Album not found
    else Caller is not owner and not admin or manager
        W-->>B: Error Insufficient permissions
    else Allowed
        W->>D: Load flamekeeper-owned photos, up to 2000 per call
        loop Each flamekeeper owner
            W->>F: Flamekeeper token: delete their files in one batch
        end
        W->>D: Drop deleted photo rows and recount the album
        alt Some deletes failed or album has over 2000 such photos
            W-->>B: Error Some photos could not be deleted from Drive<br/>or This album is too large to delete in one go.<br/>Some photos were deleted, try again to continue.
        else All flamekeeper photos gone
            W->>G: Master token: delete the album folder
            opt Master not allowed to delete a volume folder
                W->>W: Heal volumes, see flamekeepers/
                W->>T: Alert admins if volumes stay blocked
            end
            W->>D: Delete the album row, owner albumCount minus 1
            W->>T: Log "deleted" to the club channel
            W-->>B: success
            B->>M: Toast "Album deleted", go to My Albums
        end
    end
    opt Any error
        B->>M: Red toast with the message, or "Failed to delete album"
    end
```
