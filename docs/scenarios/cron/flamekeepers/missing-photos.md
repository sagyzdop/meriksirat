# How photos missing from Drive are found and removed

> **Question:** What happens to a photo whose file has
> disappeared from the flamekeeper's Drive?
>
> **Answer:** During the health probe, the cron lists each album
> folder the flamekeeper hosts and compares it with the photo
> rows in the database. For photos that are older than 1 hour
> and absent from the listing, it asks Drive about up to 10 of
> them per album. Photos that Drive says are in the bin or
> permanently deleted are marked deleted in the database and
> removed from the album, and the admins get one Telegram
> message listing them. Photos that Drive still reports, or
> whose check failed, are kept. Nothing is ever deleted from
> Drive here.
>
> **Notes:**
> - Why 1 hour: photos newer than that are skipped, so a fresh
>   upload that is not yet visible in the listing is not
>   removed.
> - Why a second check: the folder listing alone is not trusted.
>   A photo is only removed once a direct Drive lookup says
>   trashed or missing (404).
> - Photos beyond the first 10 missing in an album are not
>   checked this run and are looked at again on the next probe.
>   The 10 are picked at random.
> - Every listing page (1000 files) and every lookup costs 1
>   request from the step's cap of 24. When the cap runs out,
>   the probe saves the last finished album as a cursor, sets
>   the check time to 24 hours ago so the flamekeeper is due
>   again at once, and continues in the next run.
> - An error on one album is logged and that album is skipped.
> - The admin message is sent even if the shared budget is
>   short: its cost is added without being refused. Only admins
>   with a Telegram chat id receive it.
> - Skipped when a volume has no folder id but has live photo
>   rows (a warning is logged).

```mermaid
sequenceDiagram
    autonumber
    participant Worker
    participant D1
    participant Drive
    participant KV
    participant Telegram

    Worker->>D1: load volumes of the flamekeeper not dropped,<br/>album not deleted, album ids after the cursor
    loop each album
        Worker->>D1: load live photos of this flamekeeper in the album<br/>created more than 1 hour ago
        alt no such photos or volume has no folder id
            Worker->>Worker: skip the album
        else photos to check
            Worker->>Drive: list files in the volume folder<br/>flamekeeper token, 1000 per page, 1 request per page
            Worker->>Worker: missing = rows whose file id is not listed
            loop up to 10 missing photos picked at random
                Worker->>Drive: getDriveFolderState for the file<br/>flamekeeper token, 1 request
                Note over Worker: trashed or missing means remove<br/>ok or error means keep
            end
            opt at least one photo confirmed gone
                Worker->>D1: set photo.state = deleted, 90 ids at a time
                Worker->>D1: lower flamekeeper.usedBytes by their bytes, not below 0
                Worker->>D1: recount album photoCount, photoBytes, favoriteCount<br/>clear coverFileId if it was one of them
                Worker->>KV: delete album:list:folder id and album:detail:album id
            end
        end
    end
    alt every album done
        Worker->>D1: set healthCheckedAt = now, healthCursor = null
    else budget ran out
        Worker->>D1: set healthCursor = last finished album id<br/>healthCheckedAt = now minus 24 hours
    end
    opt any photos were removed
        Worker->>Telegram: reportMissing to every admin: #35;savenuimg health check:<br/>photos missing from Drive were removed from their albums.<br/>then up to 10 lines: email: count in album title,<br/>then ...and N more albums
    end
```
