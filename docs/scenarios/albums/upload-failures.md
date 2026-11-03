# Upload failures, retries and limits

> **Question:** What happens when a photo upload fails, and when does the browser retry on its own?
>
> **Answer:** If the transfer to Drive fails or is cancelled, the browser gives the reservation back by calling releaseUploadFn and decides whether to retry. Network errors, timeouts, Google answers 408, 429 or 5xx, a quota error, a failed confirmation and a failed session request caused by a network error are temporary: the job goes back in the queue and waits about 1, 2, 4 then 8 seconds (plus or minus 20 percent), for at most 5 attempts in total. After that the list shows "Upload failed after N attempts — retry manually" with a retry button. Any other Google answer fails at once with the message "Upload failed (STATUS)", where STATUS is Google's status number. "Storage quota exceeded" is retried like a temporary failure and also marks that flamekeeper full.
>
> **Notes:**
> - If the name already exists on the server when the session is requested (typically because an earlier attempt finished but its result was lost), the job is shown as done instead of failed.
> - The retry button restarts with a fresh attempt count. Choosing the same file again replaces the failed job.
> - Cancel aborts the transfer in progress, releases the reservation like a failure and marks the job as cancelled (the list shows a tick labelled Cancelled). Cancelling a job that is still waiting has nothing to release.
> - If the confirm step fails 3 times, no release is sent. The reservation then stops counting against the flamekeeper after 2 hours, and the maintainPool cron step deletes it 24 hours after that, see ../cron/flamekeepers/pool-top-up.md.
> - If Google answers with success but the reply has no file id, the browser skips the confirm step and shows the job as done. The reservation is then left to run out.
> - Limits: files up to 5 GB (the Worker refuses larger sizes), 2 uploads at once, 5 attempts per job.

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant F as Flamekeeper Drive
    participant W as Worker
    participant D as D1
    B->>F: PUT file bytes to the upload address
    alt Google answers 403 storageQuotaExceeded
        F-->>B: Quota error
        B->>W: releaseUploadFn(albumId, reservationId, quotaExceeded true)
        W->>D: Remove reservation, mark that flamekeeper full
    else Network error, timeout, 408, 429 or 5xx
        F-->>B: Temporary failure
        B->>W: releaseUploadFn(albumId, reservationId, quotaExceeded false)
        W->>D: Remove the reservation if it belongs to this album
    else Any other status
        F-->>B: Permanent failure
        B->>W: releaseUploadFn(albumId, reservationId, quotaExceeded false)
        W->>D: Remove the reservation
        B->>M: Job fails with the message "Upload failed (STATUS)"
    end
    alt Temporary failure and fewer than 5 attempts
        B->>B: Wait about 1, 2, 4, 8 seconds, then queue the job again
    else Temporary failure on the 5th attempt
        B->>M: "Upload failed after 5 attempts — retry manually"
        M->>B: Click the retry button
        B->>B: Reset attempts and queue the job again
    end
    alt createUploadSessionFn answers Photo already exists
        B->>M: Job shown as uploaded
    else createUploadSessionFn answers another error
        B->>M: Job shows the error text, for example Out of space
    end
```
