# Edit album details and pin an album

> **Question:** What happens when someone edits an album's details, or an admin pins it?
>
> **Answer:** The owner, co-authors and admins or managers can change title, event, event date and description. A new title also renames the Drive folder using the master token. A new event date moves the expiry to 2 years after it and resets the 30 day and 7 day reminders, unless the album is pinned. The page shows "Album updated". Only admins (not managers) can pin an album, which stops the expiry job from deleting it, and the page shows "Album pinned" or "Album unpinned".
>
> **Notes:**
> - The edit form always sends every field, so the Telegram log for an edit always lists the description and event lines, even when nothing changed.
> - The Drive rename happens before the database save. If the rename fails, nothing is saved.
> - Unpinning does not change the stored expiry date. An album whose date has passed while pinned will be picked up by the expiry job at its next run after unpinning. See cron/albums-and-housekeeping/.
> - Pinning hides the "Will be deleted" banner. The role check for pin is the admin role only, not the manager role.

```mermaid
sequenceDiagram
    autonumber
    participant M as Owner, co-author or admin
    participant B as Browser
    participant W as Worker
    participant K as KV
    participant D as D1
    participant G as Drive
    participant T as Telegram
    M->>B: Edit details, change fields, click save
    B->>W: updateAlbumFn(albumId, title, description, event, eventDate)
    W->>D: Load album and the caller's role
    alt Album missing, deleted or caller has no role
        W-->>B: Error Album not found or Insufficient permissions
    else Allowed
        opt Title changed
            W->>G: Master token: rename the album folder
            alt Folder no longer exists
                W-->>B: Error The album folder was deleted from Google Drive.<br/>Use "Recreate folder" to fix it.
            else Other Drive error
                W-->>B: Error Failed to rename the Drive folder
            end
        end
        W->>D: Update changed fields, and if event date set and<br/>album not pinned: expiresAt = date + 2 years,<br/>clear both reminder marks
        W->>K: Delete album:detail:albumId
        W->>T: Log "updated" with the change lines
        W-->>B: success
        B->>M: Toast "Album updated", dialog closes, data reloads
    end
    opt Any error
        B->>M: Red toast with the message, or "Failed to update album"
    end
    M->>B: Admin clicks Pin or Unpin
    B->>W: setAlbumPinnedFn(albumId, pinned)
    alt Caller is not an admin
        W-->>B: Error Only admins can pin albums
    else Admin
        W->>D: Load album, then set pinned
        W-->>B: success
        B->>M: Toast "Album pinned" or "Album unpinned"
    end
```
