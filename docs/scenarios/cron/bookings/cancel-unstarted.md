# Auto-cancelling bookings nobody picked up

> **Question:** When is a booking cancelled automatically because the member never started it?
>
> **Answer:** Every 5 minutes, any booking still `booked` that the member never started, and whose start time was at least 15 minutes ago, is cancelled. Its items become `cancelled`, the booking status is recalculated, and each item's calendar event is deleted. The member's `cancelled_in_start_window_count` goes up by 1. The club channel gets an "Auto-cancelled (no pickup)" log, and the member gets a Telegram message. Bookings of banned members are skipped. If the budget runs out, the step stops and the remaining bookings wait for the next run.
>
> **Notes:**
> - The budget cost per booking is its number of items (counted even if an item has no calendar event), plus 1 for the channel log, plus 1 if the Worker has a bot token and the member has a Telegram chat. The cost is taken before anything changes, so a booking is never half-cancelled for budget reasons. The cost is not refunded if the cancel then fails.
> - The 15 minutes is `START_WINDOW_GRACE_MS`. The start warning reminder tells the member the booking will be cancelled in 15 minutes (see `reminders.md`).
> - The counter goes up once per booking, not per item, and only after the cancel itself went through. If the cancel throws, nothing is counted, the error is logged, the loop moves on to the next booking, and the booking is picked up again next run.
> - A booking with no items left to cancel (all already `returned` or `cancelled`, or no items at all) still has its counter raised and still gets the log and the message.
> - A failure to write the channel log, delete a calendar event or send the Telegram message is only logged to the console and does not undo the cancel. The channel log is skipped when the bot token or the club channel id is not set, but its budget cost is taken anyway.
> - The member's message says the equipment was not picked up within 15 minutes of the start time and shows that start time (club timezone, 24-hour clock). It ends by asking the member to make a new booking if the cancel was not intended.
> - Items already `returned` or `cancelled` are left alone by the cancel.
> - Next step in the run: `mark-overdue.md`. Whole run: `../overview.md`.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cron
    participant Worker as Worker
    participant D1 as D1
    participant Calendar as Calendar
    participant Telegram as Telegram
    Cron->>Worker: cancelUnstartedBookings(env, budget)
    Worker->>D1: select bookings with status booked,<br/>started_at empty, member not banned,<br/>start_time at least 15 min ago
    alt none found
        Worker-->>Cron: return, nothing to do
    end
    loop each stale booking
        Worker->>D1: cancelWholeBooking: read item ids
        alt budget.take(items + 1 + 1 if Telegram) fails
            Worker-->>Cron: stop loop, rest wait for next run
        end
        Worker->>D1: set items to cancelled,<br/>recomputeBookingStatus
        Worker->>Calendar: deleteCalendarEventRaw per item<br/>that has an event id
        Worker->>D1: user.cancelled_in_start_window_count + 1
        Worker->>Telegram: logBookingActivityById auto_cancelled<br/>to the club channel
        opt member has chat id and bot token set
            Worker->>Telegram: sendMessage to member:<br/>Booking #id was auto-cancelled.<br/>Not picked up within 15 min of start.
        end
        opt the cancel throws
            Worker-->>Worker: log error, skip the counter,<br/>go on with the next booking
        end
    end
```
