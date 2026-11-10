# Upload failures and retries

Related: [upload](upload.md).

## What happens when an upload fails?

```mermaid
flowchart TD
    S["createUploadSessionsFn fails"] --> S1{"Which error?"}
    S1 -- "buffer missing or full, folder in bin or deleted: every job of the batch" --> S2["Job shows the message, no retry"]
    S1 -- "one file could not start" --> S2
    S1 -- "photo already exists" --> S3["Job ends as skipped, toast names the file"]
    S1 -- "network error" --> T
    P["PUT to Google fails"] --> P1{"Which answer?"}
    P1 -- "403 storageQuotaExceeded" --> Q["Fails at once with the storage-full message, file stays queued, retry button works after an admin makes room"]
    P1 -- "network error, timeout, 408, 429, 5xx" --> T
    P1 -- "any other status" --> F["Fails at once: Upload failed (STATUS)"]
    C["Confirm request fails 3 times: every job of the batch"] --> T
    C1["Confirm refuses one file"] --> F1["That job fails with the message, no retry"]
    T{"Attempt number"} -- "under 5" --> W["Wait about 1, 2, 4, 8 seconds (plus or minus 20 percent), queue again"]
    T -- "5th" --> M["Upload failed after 5 attempts, retry manually"]
    M --> R["Retry button: attempt count reset, queued again"]
```

- An uploaded file waits up to 4 seconds to share a confirm request. If the page reloads in that window, the job starts over and uploads a second copy, as when confirm keeps failing.
- If confirm keeps failing, the file may sit in the buffer's Volume folder without being counted. The next complete listing corrects the totals, and a retry uploads the photo again as a second file.
- Cancel aborts the transfer and marks the job Cancelled. Finished jobs vanish after 1 hour (done, cancelled) or 7 days (failed).

## What does the rest of the system do after an upload?

Nothing runs in the background for new uploads. The album page lists the buffer again when its expected count changed, so a new photo shows without Refresh, see [refresh](refresh.md). Hourly cron deletes albums an admin scheduled for deletion, see [cron](../../cron/). Flamekeepers hold no new photos.
