# How a drain ends

> **Question:** When does a flamekeeper stop draining, and what
> is cleaned up when they are fully drained?
>
> **Answer:** On every run, drainFlamekeepers checks each
> draining flamekeeper (finishing at most 2 per run). For a
> pledge drain, the drain ends and the flamekeeper goes back to
> active as soon as their used space is within the pledge. For
> every other reason, it ends when no live photo is left in
> their volumes. Then the cron removes their empty volume
> folders, revokes their Google grant and sets the state to
> drained with all counters reset. If anything is still
> blocking, nothing changes and the check is repeated next run.
>
> **Notes:**
> - The flamekeeper's own browser also runs this check after
>   each photo move, with a budget of 20 requests, see
>   ../../flamekeepers/.
> - Before the grant is dropped, these must all hold: all
>   volumes released (see release-volumes.md), no volume left
>   that has not been blocked for 7 days, and no upload
>   reservation still in time. The 7 days matter: a volume
>   blocked for over 7 days no longer holds the drain back, and
>   the admins were alerted about it, see drain-notices.md.
> - Revoking asks Google to cancel the refresh token. It is
>   skipped, with a warning, if the account is the club account
>   (GOOGLE_MASTER_EMAIL), whose grant must never be revoked.
>   The grant row is deleted either way.
> - The club account cannot be a flamekeeper at all, so it never
>   holds uploads and never drains. Placement also skips the
>   club account (nu_image) when choosing where an upload goes.
> - One random flamekeeper past its deadline gets deletes in
>   that run, the other overdue ones are only checked. See
>   drain-deadline.md.
> - Finishing costs 1 request from the shared budget in addition
>   to what releasing volumes costs.

```mermaid
sequenceDiagram
    autonumber
    participant Worker
    participant D1
    participant GO as Google OAuth

    Note over Worker: Inside drainFlamekeepers, for each draining flamekeeper
    Worker->>D1: reload the flamekeeper, must still be draining
    alt reason is pledge
        Worker->>Worker: usedBytes at or under pledgedBytes?
        opt yes
            Worker->>D1: set state = active, clear drain reason, deadline<br/>and reminder stamps
        end
    else any other reason
        Worker->>D1: is there any live photo in their volumes? (1 row)
        opt none left
            Worker->>Worker: finalizeDrained
            Worker->>Worker: releaseVolumes on all their volumes,<br/>see release-volumes.md, stop if some remain
            Worker->>D1: any volume not blocked for over 7 days? if yes stop
            Worker->>D1: any upload reservation not yet expired? if yes stop
            Worker->>Worker: take 1 request, if not affordable stop
            Worker->>D1: delete all their upload reservations
            opt account is not the club account
                Worker->>GO: revoke the refresh token
            end
            Worker->>D1: delete the flamekeeper_grant row
            Worker->>D1: set state = drained, usedBytes = 0, driveUsageBytes = 0<br/>clear drain reason, deadline and stamps
        end
    end
    Note over Worker: Only 2 drains that leave the draining state<br/>are counted per run, the rest wait
```
