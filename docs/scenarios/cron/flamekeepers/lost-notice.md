# What happens when a flamekeeper's Drive connection breaks

> **Question:** When Google no longer accepts a flamekeeper's
> connection, who is told and how long do they have?
>
> **Answer:** The flamekeeper is marked lost and, unless banned,
> gets one email asking them to reconnect Drive before a date 7
> days after the loss. Up to 3 such emails go out per cron run,
> 1 request each. The 7 days are only a reminder window: when they have passed,
> the cron just stamps the loss finalized (see lost-finalize.md). If the email fails to send, it is tried
> again on the next run.
>
> **Notes:**
>
> - The email goes out in the same run that marks the loss,
>   right after the probes.
> - If the budget is gone or the cap of 3 is reached, the rest
>   wait for the next run.
> - Banned flamekeepers get no reconnect email, but are still
>   finalized after 7 days.
> - The email is sent from the club account. Subject: Reconnect
>   your Google Drive to keep your flame lit. The body
>   gives the deadline date and a link to /account, and ends there.
> - Reconnecting is done by the flamekeeper in the app, see
>   ../../flamekeepers/connect-drive.md. Reconnecting
>   puts the flamekeeper back to active; no photos are restored
>   because none are dropped (removed in #24, `dev` commit
>   `2565826`).
> - How the loss is detected is in health-probe.md.

```mermaid
sequenceDiagram
    autonumber
    participant Worker
    participant D1
    participant Gmail
    participant Member as Flamekeeper

    Note over Worker: Marked lost by the probe, see health-probe.md
    Worker->>D1: set state = lost, lostSince = now
    Worker->>D1: later in the same run: load lost flamekeepers<br/>where lostNotifiedAt or lostFinalizedAt is empty
    Worker->>Worker: planLost: notify if no lostNotifiedAt and not banned<br/>finalize if lostSince is 7 days ago or more
    loop up to 3 flamekeepers to notify
        Worker->>Worker: take 1 request, if not affordable stop
        Worker->>D1: load email, name and lostSince
        Worker->>Gmail: sendEmail with the club account token:<br/>Reconnect your Google Drive to keep your photos in the app
        alt email sent
            Gmail-->>Member: please reconnect by the deadline date
            Worker->>D1: set lostNotifiedAt = now
        else send failed
            Worker->>Worker: log the error, retry next run
        end
    end
    Worker->>Worker: finalize at most 1 flamekeeper whose 7 days<br/>are over, see lost-finalize.md
```
