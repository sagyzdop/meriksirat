# Ban and unban

Admin only. Managers never see the Ban button; admins do not see it on their own page. The club master account cannot be banned. Terms: [Banned user](../../../../GLOSSARY.md).

## What happens when an admin bans a member?

```mermaid
sequenceDiagram
    actor A as Admin
    participant UI as Member detail
    participant W as Worker
    participant D1
    participant TG as Audit channel
    participant Cron as Hourly finishBans

    A->>UI: Ban member, type a reason (1 to 500 characters)
    UI->>W: banUserFn(userId, reason)
    alt self, master account, already banned, or bad reason
        W-->>UI: error toast
    else allowed
        W->>D1: set banned_at, ban_reason, banned_by
        W->>D1: delete all sessions
        W->>D1: end flamekeeping at once (drained, Drive grant dropped)
        W->>TG: ban message
        W->>D1: cancel up to 3 booked bookings, stop up to 10 banned flamekeepers
        W-->>UI: toast "Name was banned"
    end
    Cron->>D1: repeat the cancel and stop steps for what is left
```

- Only `booked` bookings are cancelled (each logged as "Account banned"). Active, overdue and partly returned bookings stay so the return is tracked.
- A banned person is sent back to `/login` with a "banned" error and cannot sign up again with that Google account.
- Nothing is held on flamekeepers, so there is no drain or photo move.

## What does unbanning do?

```mermaid
flowchart LR
    A["Unban member, confirm"] --> B["unbanUserFn"]
    B --> C["Clear banned_at, ban_reason, banned_by"]
    C --> D["Unban message to the audit channel"]
```

- Cancelled bookings stay cancelled, sessions are not restored and flamekeeping is not restarted; the person reconnects Drive themselves.
- Banning many flamekeepers at once is on the [flamekeepers page](../flamekeepers/).
