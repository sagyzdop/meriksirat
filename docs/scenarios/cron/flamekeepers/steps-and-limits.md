# The five flamekeeper steps of the cron and their limits

> **Question:** Which cron steps look after flamekeepers, in
> what order, and how much can each one do in a single run?
>
> **Answer:** Four steps run one after another in every hourly
> run: checkFlamekeeperHealth, maintainPool, drainFlamekeepers
> and finishBans, followed by expireAlbums. graduateFlamekeepers
> runs alone in the daily run at 03:00 UTC. The steps of one run
> share one budget of 40 outgoing requests, and each run has its
> own budget. Each step also has
> its own caps on how many people, emails or photos it handles.
> If a step throws, the error is only logged and the next step
> still runs. A step that runs out of budget stops early and
> carries on in the next run.
>
> **Notes:**
> - The budget counts outgoing requests to Google and Telegram,
>   not database queries. Email sends are counted by the steps
>   that send them (1 each), and Telegram admin messages cost 1
>   per admin.
> - The budget of 40 is below the Worker limit of 50 outgoing
>   requests per run.
> - The photo health check has a slice of 24 requests inside the
>   40. The reconnect emails and the admin report of the same
>   step use the rest of the budget.
> - Photo moves between flamekeepers are not done by the cron.
>   The browser of the flamekeeper does them, see
>   ../../flamekeepers/relay-move-photo.md for that.
> - Each step has its own file: health-probe.md,
>   missing-photos.md, lost-notice.md, lost-finalize.md,
>   lost-recovery.md, pool-top-up.md, drain-notices.md,
>   drain-finish.md, drain-deadline.md, release-volumes.md,
>   ban-cleanup.md, graduation-trigger.md and
>   graduation-prompt.md.

```mermaid
sequenceDiagram
    autonumber
    participant Cron
    participant Worker

    Cron->>Worker: scheduled() every hour<br/>create one budget of 40 requests
    Worker->>Worker: checkFlamekeeperHealth<br/>probes and photo checks share 24 requests<br/>at most 3 reconnect emails<br/>finalizes at most 1 lost flamekeeper<br/>restores at most 2 dropped volumes<br/>see health-probe.md
    Worker->>Worker: maintainPool<br/>no request cap of its own<br/>only the admin alert spends budget<br/>see pool-top-up.md
    Worker->>Worker: drainFlamekeepers<br/>at most 2 stuck-folder alerts, 2 drain alerts<br/>at most 2 reminder emails<br/>deletes for 1 overdue flamekeeper only<br/>at most 2 drains finished<br/>see drain-notices.md
    Worker->>Worker: finishBans<br/>at most 3 booking cancellations<br/>at most 10 volume folders released<br/>see ban-cleanup.md
    Note over Worker: Then expireAlbums,<br/>see ../albums-and-housekeeping/
    Worker->>Worker: log outside requests spent out of 40
    Cron->>Worker: scheduled() every day at 03:00 UTC<br/>create a separate budget of 40 requests
    Worker->>Worker: graduateFlamekeepers<br/>at most 3 drains started, 2 prompt emails<br/>see graduation-trigger.md
    Worker->>Worker: log outside requests spent out of 40
```
