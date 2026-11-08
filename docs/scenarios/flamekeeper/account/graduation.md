# Graduation date and automatic stop

Flamekeeping ends 60 days before the expected graduation month (the first day of the month is used).

## When does the app ask for confirmation and when does it stop?

```mermaid
flowchart TD
    D["Daily 03:00 graduateFlamekeepers"] --> R["Each non-Stopped flamekeeper"]
    R --> E{"Email no longer @nu.edu.kz?"}
    E -- yes --> STOP["End flamekeeping, send ended email (domain)"]
    E -- no --> G{"Today >= graduation date minus 60 days?"}
    G -- yes --> STOP2["End flamekeeping, send ended email (graduation)"]
    G -- no --> C{"Last confirmation older than 365 days?"}
    C -- yes --> P["Email: is your graduation date still right? (once per due date)"]
    C -- no --> N["Nothing"]
```

At most 3 stops and 2 prompt emails per run, inside the step's budget; the rest wait for the next day.

## How does a flamekeeper confirm or change the date?

```mermaid
sequenceDiagram
    autonumber
    actor F as Flamekeeper
    participant W as Worker
    participant D1
    F->>W: "Still graduating in ...? Yes" (confirmGraduationFn)
    W->>D1: graduation_confirmed_at = now
    Note over F,W: Editing the Graduating month on /account saves the same way
    F->>W: new month (saveGraduationDate)
    W->>W: must be in the future if changed
    W->>D1: update date and confirmation, keep the pledge
    W->>W: new date within 60 days? end flamekeeping now
```

- Confirmation is due 365 days after the last confirmation (sign-up counts) and applies to Active, Full and Draining, not Lost or Stopped.
- Ending clears the grant exactly as in [stop.md](stop.md).
- The stop lead is the Settings value `graduationPromptDays` (default 60); the 365-day confirmation interval is a constant ([settings/other-settings.md](../../admin/settings/other-settings.md)).
