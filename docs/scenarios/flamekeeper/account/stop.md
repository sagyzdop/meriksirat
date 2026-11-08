# Stop flamekeeping

## What happens when a flamekeeper stops?

```mermaid
sequenceDiagram
    autonumber
    actor F as Flamekeeper
    participant W as Worker
    participant G as Google
    participant D1
    F->>W: Stop, confirm "Stop flamekeeping?" (optOutFlamekeeperFn)
    W->>D1: any volumes held by this flamekeeper?
    alt none
        W->>G: revoke the refresh token
        W->>D1: delete grant, state = Stopped, used and Drive usage = 0
    else some (photos were offloaded to them)
        W->>D1: state = Draining
        Note over W,D1: the hourly drain copies the photos to the buffer, deletes the originals with their token, then stops them
    end
    W-->>F: card shows the invitation again
```

- With no photos held, ending is immediate and needs nothing more from the person. With photos held, they stay Draining until the hourly drain has moved them ([cron/hourly](../../cron/hourly.md)); nothing is asked of them.
- Stopping an already Stopped account is refused.
- The same end-of-flamekeeping runs on graduation, a non-`@nu.edu.kz` email and a ban ([graduation.md](graduation.md), [ADR-0020](../../../adr/0020-member-status-separate-from-flamekeeper-state-and-ban.md)).
- The master account's grant is never revoked at Google ([master-account](../../admin/flamekeepers/master-account.md)).
- A non-member with no active flamekeeping can then delete their account from `/account`; members keep it.
- To resume, sign up again ([become-flamekeeper](../onboarding/become-flamekeeper.md)).
