# When Drive refuses to delete an album folder

> **Question:** What happens if the master account cannot delete an
> expired album's Drive folder because flamekeeper files are in it?
>
> **Answer:** The cron tries to empty the album's volume subfolders
> using each flamekeeper's own token, then tries the folder delete
> once more. If the subfolders are all clear, the album is deleted.
> If too much remains for this tick or the budget runs out, the
> album is left whole and tried again on a later tick. If some
> subfolders cannot be emptied, the album is still deleted from the
> app, the Drive folder is kept, and every admin with Telegram gets
> an alert saying files need manual cleanup.
>
> **Notes:**
> - A volume is one flamekeeper's subfolder in one album.
> - At most 4 volumes are worked on per attempt, and the rest count
>   as unfinished. Each volume costs 3 requests to start. At most
>   50 leftover files are listed and deleted per volume.
> - Files still listed in the photo table are never deleted by
>   this. A volume is only emptied if the flamekeeper has no live
>   photos in the album and no unexpired upload reservation.
> - A volume whose flamekeeper has no Drive grant counts as
>   blocked.
> - The alert costs 1 request per admin. If the tick cannot afford
>   it, the album waits for a later tick so the alert is not lost.
>   If there are no admins, only a log line is written.
> - Alert text for blocked volumes: "#savenuimg: album ID was
>   deleted but N of its volume subfolders could not be emptied, so
>   its Drive folder may still hold public files that need manual
>   cleanup." With no counted volumes the text says the Drive folder
>   could not be removed.

```mermaid
sequenceDiagram
    autonumber
    participant Worker
    participant Drive
    participant D1
    participant Telegram
    Worker->>Drive: deleteDriveFile(driveFolderId), master token
    Drive-->>Worker: app not authorized to delete
    Worker->>D1: healAlbumVolumes, read volumes with a Drive folder
    loop each volume, first 4 only
        Worker->>Worker: spend 3 requests, none left means unfinished
        Worker->>Drive: list up to 50 files, flamekeeper token
        Worker->>D1: which listed files are still photo rows
        Worker->>Drive: batchDeleteDriveFiles of the rest,<br/>flamekeeper token
    end
    alt any volume unfinished
        Worker-->>Worker: defer, throw AlbumDeletionDeferredError
        Note over Worker: Album untouched, retried next tick
    else nothing blocked and some cleared, first time
        Worker->>Worker: spend 1 request
        Worker->>Drive: deleteDriveFile again, master token
    else blocked volumes remain, or already retried
        Worker->>Worker: spend 1 request per admin
        Worker->>Telegram: sendMessage to each admin chat
        Worker->>Worker: continue, Drive folder is kept
        Worker->>D1: album tombstoned as in expiry-delete.md
    end
```
