# Every 5 minutes: bookings

Schedule `*/5 * * * *`. Code: `src/lib/booking/cron.ts`. Budget rules: [overview.md](overview.md).

What happens to a booking that is never picked up?

```mermaid
flowchart TD
    A["booked, not started, owner not banned,<br/>startTime older than 15 minutes"] --> B{budget for items + 1 calendar/Telegram calls}
    B -- no --> Z[Stop, retry next run]
    B -- yes --> C[Cancel whole booking and its calendar events]
    C --> D[Owner cancelledInStartWindowCount +1]
    D --> E[Log activity and message the owner if linked to Telegram]
```

What happens to equipment that is still out after the end time?

```mermaid
flowchart TD
    A["Items with status active,<br/>booking endTime older than 15 minutes"] --> B[Group by booking, take budget per booking]
    B --> C[Item status overdue and calendar event renamed OVERDUE]
    C --> D[Recompute booking status]
    D --> E[Owner overdueCount +1, once per booking]
    E --> F[Log activity and message the owner]
```

When are reminders sent?

```mermaid
flowchart LR
    A["pre_start<br/>starts in 15-20 min"] --> B["start_warning<br/>0-10 min after start"]
    B --> C["return_warning<br/>0-10 min after end"]
    C --> D["grace_5min<br/>10-15 min after end"]
```

- Each reminder sets its own `*_sent_at` column on `booking` (`start_reminder_sent_at`, `start_warning_sent_at`, `return_reminder_sent_at`, `grace_warning_sent_at`), so it is sent once. Costs one request per booking; the step returns when the budget is gone.
- The two start reminders need status `booked`. The two return reminders need at least one item not returned or cancelled.
- Users without a Telegram chat are skipped. Without `TELEGRAM_BOT_TOKEN` the whole reminder step is skipped, auto-cancel and overdue still run.
- The 15-minute grace is `START_WINDOW_GRACE_MS`.
