# How the storage pool is checked

> **Question:** What does the cron do about the flamekeeper pool,
> and when are admins told that pledged space is running low?
>
> **Answer:** maintainPool puts any flamekeeper still marked full
> back to active, and checks whether the free space of the pool
> is under 10% of what was pledged (or nothing is pledged at
> all). If so, and no alert is already out, every admin with
> Telegram gets a low-space message. When space recovers, the
> alert is re-armed so it can fire again later. It adds no new
> flamekeepers or space by itself.
>
> **Notes:**
> - Nothing is stored on flamekeepers until Stage 2 of #15, so
>   this step does little: no placement, reservations or upload
>   slots exist any more (removed in #24, last `dev` commit
>   containing them: `2565826`). Uploads go to the buffer, see
>   ../../albums/upload-to-buffer.md. The buffer's own usage
>   warning is in buffer-usage.md.
> - Usable space of a flamekeeper is the smaller of two: pledge
>   minus used, and the per-account cap minus Drive usage. The
>   cap comes from settings.flamekeeperCapBytes, 20 GB by default.
> - Free space counts active flamekeepers only. Full ones add to
>   the pledged total but not to the free total.
> - The alert costs 1 request per admin. If admins have no
>   Telegram chat, or the budget is short, the alert is not
>   marked as sent and is tried again next run. If the bot token
>   is missing, the alert is counted as sent without sending.
> - If the settings row does not exist, the step stops after
>   resetting full flamekeepers.

```mermaid
sequenceDiagram
    autonumber
    participant Cron
    participant Worker
    participant D1
    participant Telegram

    Cron->>Worker: maintainPool
    Worker->>D1: set state = active where state = full
    Worker->>D1: load active flamekeepers, the cap and poolLowAlertedAt
    Worker->>Worker: poolStats and poolAlert:<br/>low means free under 10% of pledged or pledged is 0
    alt low and no alert sent yet
        Worker->>D1: load admins that have a Telegram chat id
        Worker->>Worker: take 1 request per admin<br/>if not affordable, try again next run
        Worker->>Telegram: #35;savenuimg pool is low: X GB free of Y GB pledged<br/>across N flamekeepers. Recruit flamekeepers or free up space.
        Worker->>D1: set settings.poolLowAlertedAt = now
    else not low and an alert was sent before
        Worker->>D1: set settings.poolLowAlertedAt = null (re-arm)
    end
```
