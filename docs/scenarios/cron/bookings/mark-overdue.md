# Marking late returns as overdue

> **Question:** When does equipment become overdue, and what changes?
>
> **Answer:** Every 5 minutes, each item that is still `active` and whose booking ended at least 15 minutes ago becomes `overdue`. Its calendar event title changes to "<equipment> (OVERDUE)" with the status updated in the description, and the event is not deleted or moved. The booking status is recomputed (it becomes `overdue`), the member's `overdue_count` goes up by 1 per booking, the club channel gets an "Overdue" log, and the member gets a Telegram message. If the budget cannot cover a booking, that booking and all later ones wait for the next run.
>
> **Notes:**
> - The 15 minutes is the grace period after the booking's end time (`START_WINDOW_GRACE_MS`). The grace reminders in `reminders.md` fire inside this window.
> - Only `active` items are picked. A booking that was never started is cancelled by `cancel-unstarted.md` instead.
> - Cost is taken per booking up front: 1 per item that has both a calendar event id and an equipment calendar id, plus 1 for the channel log, plus 1 if the member has a chat id and the bot token is set.
> - The booking counter is bumped once per booking, after the item update succeeded. If an item update fails, that item is not retried because the next run only looks for `active` items, and the booking is not counted for it.
> - The calendar event starts at `started_at` (or the booked start if empty) and ends at the booked end time.
> - A failed calendar update, log or Telegram message is only logged to the console.
> - Previous step: `cancel-unstarted.md`. Next: `reminders.md`.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cron
    participant Worker as Worker
    participant D1 as D1
    participant Calendar as Calendar
    participant Telegram as Telegram
    Cron->>Worker: updateOverdueBookings(env, budget)
    Worker->>D1: select items with status active<br/>whose booking end_time is<br/>at least 15 min ago
    loop each booking, in order
        Worker->>Worker: budget.take(calendar items + 1<br/>+ 1 if Telegram)
        alt budget short
            Worker-->>Worker: stop, this and later bookings wait
        end
    end
    loop each affordable item
        Worker->>D1: set item status = overdue
        opt item has event id and equipment has calendar id
            Worker->>Calendar: updateCalendarEventRaw<br/>title (OVERDUE), same times
        end
    end
    loop each touched booking
        Worker->>D1: recomputeBookingStatus
        Worker->>D1: user.overdue_count + 1
        Worker->>Telegram: logBookingActivityById overdue<br/>to the club channel
    end
    opt bot token set
        loop each touched booking with member chat id
            Worker->>Telegram: sendMessage to member:<br/>Booking #id is now overdue.
        end
    end
```
