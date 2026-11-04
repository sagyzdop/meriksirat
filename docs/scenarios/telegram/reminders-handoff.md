# Reminder messages sent to members

> **Question:** Where do the bot's reminder and warning messages
> come from?
>
> **Answer:** They do not come from a member's message. The
> 5-minute cron sends them straight to the member's linked chat.
> The bot's webhook never sees them and has no handler for them.
>
> **Notes:**
> - Reminder timing, wording and the sent-at markers are in
>   `../cron/bookings/reminders.md`. The auto-cancel notice is in
>   `../cron/bookings/cancel-unstarted.md` and the overdue notice
>   in `../cron/bookings/mark-overdue.md`.
> - The bot's command list is set separately, once per deploy, by
>   the hourly cron. See `main-menu.md`.
> - A member who replies to a reminder is handled like any other
>   message, see `message-routing.md`.

```mermaid
sequenceDiagram
    autonumber
    participant Cron
    participant Telegram
    actor Member
    participant Worker
    Cron->>Telegram: send reminder to user.telegram_chat_id<br/>see ../cron/bookings/reminders.md
    Telegram-->>Member: reminder message
    Member->>Telegram: replies or taps a button
    Telegram->>Worker: POST /api/telegram<br/>see webhook.md
```
