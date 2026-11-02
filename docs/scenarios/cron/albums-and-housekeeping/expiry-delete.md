# Deleting an expired album

> **Question:** What exactly is deleted when an album expires, and
> whose Google account does the deleting?
>
> **Answer:** Each tick the cron deletes at most 3 expired albums.
> Photos stored in a flamekeeper's Drive are deleted first, using
> that flamekeeper's own token, in batches of 100 files per request.
> Then the album's Drive folder in the club master account is
> deleted using the master token. Then the cached listing and
> detail page are cleared, the photo and volume rows are removed,
> and the album row stays as a tombstone with reason "expired" so
> its link shows "This album has expired". The owner's album count
> goes down by one. If anything fails the album stays as it was and
> the next tick tries again.
>
> **Notes:**
> - Cost of one album is 1, plus for each flamekeeper holding its
>   photos 1 plus 1 per 100 photos, plus 1 for the master token on
>   the first album of the tick. If the tick cannot afford an album
>   it is skipped and the next one is tried.
> - The list is rotated by the current 5-minute slot, so the same
>   album is not always first. The limit of 3 counts every album
>   attempted, including ones that then fail.
> - At most 2000 flamekeeper photos are removed per attempt. A
>   larger album fails with "This album is too large to delete in
>   one go. Some photos were deleted, try again to continue." and
>   continues on the next tick.
> - Photos with no flamekeeper are not deleted one by one. They go
>   when the master deletes the folder.
> - If a flamekeeper is lost or drained, their photos are given up
>   and the Drive folder is kept. The album is still tombstoned and
>   no admin is alerted.
> - A Drive folder already gone (not found) counts as deleted.
> - Folder refused by Drive is in `expiry-blocked-folder.md`.

```mermaid
sequenceDiagram
    autonumber
    participant Cron
    participant Worker
    participant D1
    participant Drive
    participant KV
    participant Google OAuth
    Cron->>Worker: runAlbumExpiry, expire list from planExpiry
    loop each album, rotated, until 3 attempted
        Worker->>D1: count photos per flamekeeper for the album
        Worker->>Worker: cost = removalCost, plus 1 if no master token yet
        alt budget cannot afford the cost
            Worker->>Worker: skip, try the next album
        else affordable
            Worker->>Google OAuth: getGoogleAccessToken, master refresh token
            Worker->>D1: loadOwnedPhotos, first 2001 flamekeeper photos
            Worker->>Drive: batchDeleteDriveFiles, 100 per request,<br/>flamekeeper token for each owner
            Worker->>D1: dropPhotoRows, 90 per delete, recount album
            alt some Drive deletes failed
                Worker->>Worker: log "Failed to expire album", stay as is
            else every flamekeeper photo deleted or given up
                Worker->>Drive: deleteDriveFile(driveFolderId), master token
                alt Drive error other than not found or refused
                    Worker->>Worker: log "Failed to expire album", stay as is
                end
                Worker->>KV: invalidateCachedListing and invalidateCachedDetailCore
                Worker->>D1: delete photo and volume rows of the album
                Worker->>D1: album deletedAt = now, tombstoneReason = expired,<br/>counts 0, coverFileId null
                Worker->>D1: owner albumCount = albumCount - 1, at least 0
            end
        end
    end
```
