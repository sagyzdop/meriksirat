# Channel log and reminders

Related: [cron](../../cron/), [return](return-equipment.md).

## How do bot actions reach the club channel?

Starting, cancelling and returning through the bot each post to the admin channel. Posting never blocks the member's action.

```mermaid
flowchart TD
    A["Start, cancel or photo return succeeds"] --> B{"TELEGRAM_BOT_TOKEN and TELEGRAM_CLUB_CHANNEL_ID set?"}
    B -- no --> X["Skipped"]
    B -- yes --> C["Read the booking, owner and item names from D1"]
    C --> D{"Booking found?"}
    D -- no --> W["Console warning, nothing posted"]
    D -- yes --> E{"Event"}
    E -- "picked up or cancelled" --> F["sendMessage, HTML, no link preview, links to /admin/bookings/ID"]
    E -- returned --> G["sendPhoto, caption up to 1024 characters (equipment list shortened to a count if longer)"]
```

- Failures are only written to the console.
- The same builder logs other events (booked, extended, edited, overdue, auto-cancelled, albums, bans), triggered elsewhere.

## Where do reminders come from?

```mermaid
sequenceDiagram
    autonumber
    participant C as Cron (every 5 minutes)
    participant T as Telegram
    actor M as Member
    participant W as Worker
    C->>T: Reminder, auto-cancel or overdue notice to user.telegram_chat_id
    T-->>M: Message
    M->>T: Replies or taps a button
    T->>W: POST /api/telegram, handled like any message
```

The webhook has no handler for reminders. Timing, wording and the sent-at markers are described in [cron](../../cron/).
