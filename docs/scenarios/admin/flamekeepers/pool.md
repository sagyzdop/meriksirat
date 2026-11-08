# Pool

The pool is the free pledged space of Active flamekeepers, used only to pick offload destinations ([GLOSSARY](../../../../GLOSSARY.md), Pool). Uploads go to the buffer, not the pool.

## How is the pool measured and when are admins warned?

```mermaid
flowchart TD
    H["Hourly maintainPool"] --> R["Full flamekeepers back to Active"]
    R --> S["Count Active and Full: pledged, used"]
    S --> F["Free = sum over Active of min(pledge left, cap minus Drive usage)"]
    F --> L{"(pledged - free) / pledged >= pool-low % ? (no pledges counts as low)"}
    L -- "yes, not yet alerted" --> T["Telegram to admins with a linked chat, then store poolLowAlertedAt"]
    L -- "no, but alerted before" --> RE["Clear poolLowAlertedAt (re-arm)"]
    L -- otherwise --> N["Nothing"]
```

- One alert per crossing. If the Telegram send is skipped for budget, it is retried next hour.
- The cap per account (default 20 GB, 1-1024) and the pool-low percent (default 90, 50-99) are set in [settings/storage.md](../settings/storage.md).
- Pool numbers are shown on the dashboard Flamekeepers and Storage tabs ([dashboard](../dashboard/overview.md)) and the cap on each [detail](detail.md) page.
- Lost, Draining and Stopped flamekeepers are not counted. Offload, the only user of the pool, is Stage 2 of #15 and not built.
