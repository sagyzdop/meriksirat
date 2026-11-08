# Hourly

Schedule `0 * * * *`. Steps run in this order. Budget rules: [overview.md](overview.md). Flamekeeper states and the buffer: [GLOSSARY.md](../../../GLOSSARY.md).

```mermaid
flowchart TD
    A[checkFlamekeeperHealth] --> B[maintainPool]
    B --> C[drainFlamekeepers]
    C --> D[finishBans]
    D --> E[deleteScheduledAlbums]
    E --> F[checkBufferUsage]
    F --> F2[switchBuffer]
    F2 --> G[Telegram bot configuration]
```

What does the health check do?

```mermaid
flowchart TD
    A["Active, Full or Draining flamekeepers<br/>not checked for 24 h, oldest first"] --> B["Up to 12 per run<br/>(2 requests each, slice of 24)"]
    B --> C{Refresh token and Drive about.get}
    C -- ok --> D[Store Drive usage, sync email if Google reports a new one]
    C -- grant revoked --> E[State Lost, lostSince set]
    C -- other error --> F[Retry in 1 hour]
    E --> G["Lost rows: reconnect email once<br/>(max 3 per run, not for banned)"]
    G --> H["After 7 days: lostFinalizedAt set"]
```

What does the pool-low alert do?

```mermaid
flowchart TD
    A["Active with no room left becomes Full,<br/>Full with room again becomes Active"] --> B["Pool = Active and Full flamekeepers<br/>% used = (pledged - free) / pledged"]
    B --> C{"% used at or above the setting<br/>(poolLowAlertPercent, default 90)"}
    C -- yes, not alerted yet --> D[Telegram every admin, set poolLowAlertedAt]
    C -- no, was alerted --> E[Clear poolLowAlertedAt]
```

How does a draining or banned flamekeeper end, and what happens to a lost one's photos?

```mermaid
flowchart TD
    A["drainFlamekeepers: up to 10 Draining rows, 2 requests each"] --> B{Live volumes held?}
    B -- some, buffer full --> P["Pause, alert admins once per 24 h<br/>(KV drain-paused)"]
    B -- some --> R["Rescue up to 3 albums to the buffer<br/>(needs 12 requests each)"]
    B -- none --> C["Clean this flamekeeper's dropped volumes:<br/>delete the originals with their token"]
    R --> C
    C --> B2{Any volume row left?}
    B2 -- no --> S[Stopped: grant dropped]
    B2 -- yes --> W[Retry next run]
    L["Up to 3 Lost flamekeepers with live volumes"] --> LR["Rescue their albums with the buffer's full token;<br/>originals stay until they reconnect"]
    CL["Then up to 10 dropped volumes anywhere,<br/>older than 15 min, album not mid-move"] --> CD["List with the owner's token, delete the files,<br/>delete the folder and the row"]
    X["finishBans"] --> Y["Cancel up to 3 booked bookings of banned users"]
    X --> Z["End flamekeeping for up to 10 banned flamekeepers"]
```

Ending flamekeeping (`endFlamekeeping`) moves a flamekeeper to Draining while any volume row of theirs remains (live or dropped), otherwise to Stopped. Dropped volumes are rows whose files the app no longer lists: buffer originals after an offload, flamekeeper originals after a rescue, and partial copies of an abandoned move ([album-offload](../kv/album-offload.md)). A lost or stopped owner's dropped volumes wait until the owner can be reached again.

What do scheduled deletions and the buffer check do?

```mermaid
flowchart TD
    A["Albums with scheduledDeletionAt in the past, not deleted"] --> B["Up to 3 per run, start rotates by hour,<br/>each needs 8 requests"]
    B --> C[removeAlbum with the master token]
    C -- deferred --> D[Retry next run]
    E[checkBufferUsage] --> F{Usage cache older than 50 min?}
    F -- yes --> G["Read Drive quota (4 requests)"]
    F -- no --> H[Use cache]
    G --> I[Compute level: ok, warn, full]
    H --> I
    I --> J{Crossed 90% or 100% since the last marker?}
    J -- yes --> K[Telegram every admin, set KV buffer:alert]
    J -- level ok --> L[Clear marker]
```

- Telegram bot configuration runs after the steps. It calls `setMyCommands` only when the deployed version differs from the KV marker [telegram-bot-version](../kv/telegram-bot-version.md).
- The lost grace period comes from the `lostGraceDays` setting (default 7) and the graduation stop lead from `graduationPromptDays` (default 60); the code constants are only the defaults.
- Related KV keys: [drain-paused](../kv/drain-paused.md), [buffer-usage](../kv/buffer-usage.md).
