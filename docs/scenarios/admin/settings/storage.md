# Storage settings

`/admin/settings/storage` has a Buffer section (admins and managers) and a Flamekeepers section (admins only). Definitions: [GLOSSARY](../../../../GLOSSARY.md) (Buffer, Pool).

## How is the buffer account connected, switched or recovered?

```mermaid
flowchart TD
    A[Admin presses Connect] --> B[Google consent, full drive scope]
    B --> C{Account allowed?}
    C -- master, user or flamekeeper --> X[Refused with a message]
    C -- same as buffer --> R[Replace token, state ok]
    C -- env account, first time --> AD[Store grant, adopt existing volumes]
    C -- different account --> P[Store as pending]
    P --> H[Hourly switchBuffer or Copy more now]
    H --> V[Copy each album's volumes, verify, swap]
    V --> F{Albums left?}
    F -- yes --> H
    F -- no --> FL[Pending becomes active, old becomes retiring for 7 days]
    P --> CX[Cancel: staged copies dropped, nothing changes]
```

- Only admins connect or cancel. The account must not be registered in the app, a flamekeeper or the master.
- A grant has a state: `ok`, `auth_failed` (revoked), `quota_full` or `missing` (volume folder gone). Anything but `ok` pauses uploads, adds a dashboard alert and sends one Telegram message. Reconnecting the same account clears it. Nothing switches or deletes automatically.
- Volume folders are named `V01<id>`, numbered per album.

## How are the buffer limit and alert set, and when are admins warned?

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin or manager
    participant W as Worker
    participant D as Drive quota (buffer token)
    participant S as D1 app_state
    participant TG as Telegram
    A->>W: Save limit (GB) and alert %
    W->>D: read current usage (cached up to 10 min)
    alt limit below used bytes
        W-->>A: error, ceiling cannot be lower than used space
    else ok
        W->>W: store bufferLimitBytes and bufferAlertPercent (50-99)
    end
    Note over W,TG: Hourly checkBufferUsage
    W->>D: refresh usage if cache older than 50 min
    W->>W: level = ok, warn (>= alert %) or full (>= effective limit)
    W->>S: compare with marker buffer:alert
    W->>TG: one message to admins per crossing of warn and of full
```

- The effective limit is the smaller of the configured limit and the Drive quota. Percent used is measured against the configured limit.
- At warn, `@nu.edu.kz` users see a banner asking for flamekeepers; at full, uploads are refused ([ADR-0015](../../../adr/0015-buffer-is-stable-photo-storage.md)). Dropping back to ok clears the marker so the next crossing alerts again.

## How are the flamekeeper cap and pool-low alert set?

```mermaid
flowchart LR
    A["Admin edits Per-account cap (1-1024 GB) and Pool-low alert (50-99 %)"] --> S["Save"]
    S --> C["settings.flamekeeperCapBytes"]
    S --> P["settings.poolLowAlertPercent"]
    C & P --> H["Read by hourly maintainPool and by dashboards"]
```

Managers do not see this section. How the pool and its alert work: [../flamekeepers/pool.md](../flamekeepers/pool.md).
