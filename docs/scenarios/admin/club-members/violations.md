# Violations

The Violations tab lists members with a counter above zero. Two counters live on the user: `cancelledInStartWindowCount` (no-shows, auto-cancelled by the cron) and `overdueCount` (items that went overdue). Overdue forgiveness lowers `overdueCount` by one. See [Glossary](../../../../GLOSSARY.md) and [cron](../../cron/).

## How do admins review and clear violations?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI
    participant W as Worker
    participant D1

    A->>UI: open Violations tab (filter type, search, sort)
    UI->>W: getViolationsFn
    W->>D1: users with auto-cancelled > 0 or overdue > 0
    W-->>UI: rows, default sort auto-cancelled desc
    A->>UI: open a member, Violations tab
    A->>UI: Clear Violations, confirm
    UI->>W: resetUserViolationCountersFn(userId)
    W->>D1: both counters = 0
    W-->>UI: toast "Violation counters reset"
```

- Clearing changes no booking. The button is disabled while both counters are zero.
- The type filter is Auto-cancelled or Overdue. Rows link to [member detail](detail.md).
