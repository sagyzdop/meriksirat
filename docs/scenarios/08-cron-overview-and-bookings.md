# Scheduled Jobs and Booking Timers

Every 5 minutes Cloudflare's clock wakes the Worker and runs 13 background steps in a fixed order. This file shows the whole run, then the three steps that look after bookings: auto-cancel, overdue and the four Telegram reminders.

## Data
Nothing here is stored in KV or R2. The tracking columns on `booking` are what make each reminder fire only once.

```mermaid
erDiagram
  user ||--o{ booking : makes
  booking ||--|{ booking_item : contains
  equipment ||--o{ booking_item : "is held by"
  user {
    text id PK
    text telegram_chat_id "where reminders are sent, may be empty"
    text first_name
    integer banned_at "set means banned, skipped by auto-cancel"
    integer cancelled_in_start_window_count "plus 1 per auto-cancel"
    integer overdue_count "plus 1 per overdue booking"
  }
  booking {
    integer id PK
    text user_id FK
    integer start_time
    integer end_time
    text status "booked, active, returned, cancelled, overdue, partially_returned"
    integer started_at "set when picked up"
    integer start_reminder_sent_at "pre_start reminder"
    integer start_warning_sent_at "start_warning reminder"
    integer return_reminder_sent_at "return_warning reminder"
    integer grace_warning_sent_at "grace_5min reminder"
  }
  booking_item {
    integer id PK
    integer booking_id FK
    integer equipment_id FK
    text status "booked, active, returned, cancelled, overdue"
    text gcal_event_id "calendar event of this item"
    integer updated_at
  }
  equipment {
    integer id PK
    text model_name
    text short_name
    text gcal_id "calendar of this equipment"
  }
```

## The 5-minute run, all 13 steps
The cron trigger is `*/5 * * * *`. The Worker's `scheduled` handler starts `runScheduled` in the background. One shared budget of 40 outside requests (Telegram, Google, Drive calls) is created per run. Cloudflare allows 50 per run, so 10 are kept spare. Each step spends from the same budget in the order below. Only the last step does not use the budget.

```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker

  Cron->>Worker: scheduled every 5 minutes
  Worker->>Worker: runScheduled creates budget of 40 requests
  Note over Worker: Every step is wrapped in its own try/catch.<br/>A failing step logs "Error in stepName" and the next step still runs.
  Worker->>Worker: 1 cancelUnstartedBookings
  Note right of Worker: this file, 08-cron-overview-and-bookings.md
  Worker->>Worker: 2 updateOverdueBookings
  Note right of Worker: this file, 08-cron-overview-and-bookings.md
  Worker->>Worker: 3 sendBookingReminders
  Note right of Worker: this file, 08-cron-overview-and-bookings.md
  Worker->>Worker: 4 checkFlamekeeperHealth
  Note right of Worker: see 09-cron-flamekeepers.md
  Worker->>Worker: 5 maintainPool
  Note right of Worker: see 09-cron-flamekeepers.md
  Worker->>Worker: 6 drainFlamekeepers
  Note right of Worker: see 09-cron-flamekeepers.md
  Worker->>Worker: 7 finishBans
  Note right of Worker: see 09-cron-flamekeepers.md
  Worker->>Worker: 8 graduateFlamekeepers
  Note right of Worker: see 09-cron-flamekeepers.md
  Worker->>Worker: 9 expireAlbums
  Note right of Worker: see 10-cron-albums-and-housekeeping.md
  Worker->>Worker: 10 notifyPublicAlbums
  Note right of Worker: see 10-cron-albums-and-housekeeping.md
  Worker->>Worker: 11 backfillAlbumPhotos
  Note right of Worker: see 10-cron-albums-and-housekeeping.md
  Worker->>Worker: 12 configureTelegramBot
  Note right of Worker: see 10-cron-albums-and-housekeeping.md
  Worker->>Worker: 13 cleanupStaleSignups, takes no budget
  Note right of Worker: see 10-cron-albums-and-housekeeping.md
  Worker->>Worker: log "[cron] outside requests spent/40"
  alt budget runs out during a step
    Note over Worker: That step stops doing further work and the rest waits for the next run 5 minutes later.<br/>Every later step finds little or nothing left and skips its outside calls.<br/>Step 13 still runs because it never uses the budget.
  end
  alt a step throws an error
    Note over Worker: The error is logged and the run continues with the next step.
  end
```

## Auto-cancel of bookings nobody picked up (step 1)
A booking is cancelled once 15 minutes have passed since its start time and it was never started. Bookings of banned users are left alone.

```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Calendar as Calendar
  participant Telegram as Telegram

  Cron->>Worker: cancelUnstartedBookings
  Worker->>D1: select bookings with status booked, started_at empty, user banned_at empty, start_time at or before now minus 15 minutes
  alt no stale bookings
    Worker-->>Cron: step ends, nothing written
  end
  loop each stale booking
    Worker->>D1: select the booking's items
    Worker->>Worker: cost = items + 1 + 1 if the user has a Telegram chat and the bot token is set
    alt budget cannot afford the cost
      Worker-->>Cron: stop the loop, remaining bookings wait for the next run
    end
    Worker->>Worker: cancelBookingItems
    Worker->>D1: set each item status = cancelled, except items already returned or cancelled
    Worker->>D1: recompute booking status from items, becomes cancelled
    loop each cancelled item with a calendar event
      Worker->>Calendar: delete the equipment calendar event, master token
    end
    Worker->>D1: user cancelled_in_start_window_count = count + 1
    Worker->>Telegram: logBookingActivityById to the club channel, event auto_cancelled, "⏱ Auto-cancelled (no pickup)"
    Note right of Telegram: Only sent if the bot token and club channel are set
    opt user has a telegram_chat_id and the bot token is set
      Worker->>Telegram: sendMessage to the member
      Note right of Telegram: "❌ Booking (number sign)ID was auto-cancelled." then "You did not pick up your equipment within 15 minutes of the start time (HH:MM). If this wasn't intentional, please make a new booking." Time is Almaty time.
    end
    Note over Worker: An error for one booking is logged and the loop moves on.<br/>A failed channel log or Telegram message is logged and does not undo the cancel.
  end
```

## Overdue bookings (step 2)
An item becomes overdue 15 minutes after the booking's end time if it is still active, meaning picked up but not returned. Items that were never picked up are not touched here.

```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Calendar as Calendar
  participant Telegram as Telegram

  Cron->>Worker: updateOverdueBookings
  Worker->>D1: select items with status active whose booking end_time is at or before now minus 15 minutes
  Worker->>Worker: group the items by booking
  loop each booking, in order
    Worker->>Worker: cost = items with a calendar event + 1 + 1 if the user has a Telegram chat and the bot token is set
    alt budget cannot afford the cost
      Worker->>Worker: stop, this booking and later ones wait for the next run
    end
  end
  loop each item of an affordable booking
    Worker->>D1: set item status = overdue
    opt item has a calendar event id
      Worker->>Calendar: update event, master token
      Note right of Calendar: Title becomes "Model name (OVERDUE)" and the description shows status overdue.<br/>Start and finish times are not changed, the event is not deleted.
    end
    Note over Worker: An error on one item is logged and the next item continues.
  end
  loop each booking that had at least one item changed
    Worker->>D1: recompute booking status from items, becomes overdue
    Worker->>D1: user overdue_count = count + 1, once per booking
    Worker->>Telegram: logBookingActivityById to the club channel, event overdue, "⚠️ Overdue"
    Note right of Telegram: Only sent if the bot token and club channel are set
  end
  opt bot token is set
    loop each changed booking whose user has a telegram_chat_id
      Worker->>Telegram: sendMessage to the member
      Note right of Telegram: "⚠️ Booking (number sign)ID is now overdue." then "Please return the equipment as soon as possible via the Return Equipment flow."
    end
  end
```

## The four booking reminders (step 3)
All times are measured from the moment of the run. Each reminder is sent to the member's Telegram chat, once per booking, and the matching column on `booking` is set after it is sent. Members without a `telegram_chat_id` get nothing and no column is set. If the bot token is missing the whole step logs "TELEGRAM_BOT_TOKEN not configured, skipping reminders" and does nothing.

```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Telegram as Telegram

  Cron->>Worker: sendBookingReminders
  alt TELEGRAM_BOT_TOKEN not set
    Worker-->>Cron: warn and stop the step
  end
  Note over Worker: Four kinds are checked one after another in this order.<br/>Each kind has its own query window.
  loop kind 1 pre_start
    Worker->>D1: select bookings with status booked, start_time from now plus 15 to now plus 20 minutes, start_reminder_sent_at empty
    Note right of D1: one row per item, grouped per booking
    Worker->>Worker: skip bookings whose user has no telegram_chat_id
    alt budget cannot afford 1 request
      Worker-->>Cron: stop the whole step, later reminders and kinds are skipped
    end
    Worker->>Telegram: sendMessage to the member
    Note right of Telegram: "⏰ Booking Reminder" - Your booking starts in ~15 minutes. Equipment and time range in Almaty time. Please arrive on time. Tap "▶️ Start Booking" when you pick up the equipment.
    Worker->>D1: set booking start_reminder_sent_at = now
  end
  loop kind 2 start_warning
    Worker->>D1: select bookings with status booked, start_time from now minus 10 minutes to now, start_warning_sent_at empty
    Worker->>Telegram: sendMessage to the member, cost 1 request
    Note right of Telegram: "🔔 Booking Start Time" - Your booking was supposed to start now. Tap "▶️ Start Booking" now, or the booking will be automatically cancelled in 15 minutes.
    Worker->>D1: set booking start_warning_sent_at = now
  end
  loop kind 3 return_warning
    Worker->>D1: select bookings with end_time from now minus 10 minutes to now, having an item not returned and not cancelled, return_reminder_sent_at empty
    Worker->>Telegram: sendMessage to the member, cost 1 request
    Note right of Telegram: "⏰ Time's Up" - Your booking time has ended. Please return the equipment within the 15-minute grace period. Tap "↩️ Return Equipment" and send a photo of the equipment.
    Worker->>D1: set booking return_reminder_sent_at = now
  end
  loop kind 4 grace_5min
    Worker->>D1: select bookings with end_time from now minus 15 to now minus 10 minutes, having an item not returned and not cancelled, grace_warning_sent_at empty
    Worker->>Telegram: sendMessage to the member, cost 1 request
    Note right of Telegram: "⏰ 5 Minutes Left" - You have 5 minutes left in the grace period to return equipment. Please return it now via "↩️ Return Equipment".
    Worker->>D1: set booking grace_warning_sent_at = now
  end
  Note over Worker: If a Telegram send fails, the error is logged and the column stays empty, so the next run tries again while the booking is still in the window.<br/>A failing query for one kind is logged and the next kind still runs.
```

## One booking over time
Start time is S and end time is E. The cron runs every 5 minutes, so each event happens at the first run inside its window. The 5-minute-wide window of kind 1 is hit by exactly one run. The 10-minute windows are hit by two runs, and the tracking column stops the second one.

```mermaid
sequenceDiagram
  autonumber
  participant Member as Member
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Telegram as Telegram

  Note over Cron,Telegram: S minus 20 to S minus 15 minutes
  Cron->>Worker: sendBookingReminders pre_start
  Worker->>Telegram: "⏰ Booking Reminder", starts in ~15 minutes
  Worker->>D1: start_reminder_sent_at = now
  Note over Cron,Telegram: S to S plus 10 minutes, only while still booked
  Cron->>Worker: sendBookingReminders start_warning
  Worker->>Telegram: "🔔 Booking Start Time", cancelled in 15 minutes unless started
  Worker->>D1: start_warning_sent_at = now
  alt member taps Start Booking before S plus 15
    Member->>Worker: booking becomes active and no auto-cancel happens
  else not started by S plus 15 minutes, first run from S plus 15 to S plus 20
    Cron->>Worker: cancelUnstartedBookings
    Worker->>D1: items and booking cancelled, cancelled_in_start_window_count plus 1
    Worker->>Telegram: "❌ Booking (number sign)ID was auto-cancelled."
  end
  Note over Cron,Telegram: E to E plus 10 minutes, only if an item is not returned or cancelled
  Cron->>Worker: sendBookingReminders return_warning
  Worker->>Telegram: "⏰ Time's Up", return within the 15-minute grace period
  Worker->>D1: return_reminder_sent_at = now
  Note over Cron,Telegram: E plus 10 to E plus 15 minutes, if still not returned
  Cron->>Worker: sendBookingReminders grace_5min
  Worker->>Telegram: "⏰ 5 Minutes Left"
  Worker->>D1: grace_warning_sent_at = now
  Note over Cron,Telegram: from E plus 15 minutes, first run from E plus 15 to E plus 20, only for active items
  Cron->>Worker: updateOverdueBookings
  Worker->>D1: items and booking overdue, overdue_count plus 1
  Worker->>Telegram: "⚠️ Booking (number sign)ID is now overdue."
```
