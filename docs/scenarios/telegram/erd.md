# Telegram bot data

> **Question:** Which tables and stored values does the Telegram bot
> read or write?
>
> **Answer:** The bot reads and writes `user` (to link a chat),
> `telegram_link_token` (link tokens), and `booking` and
> `booking_item` (to list, start, cancel and return), and reads
> `equipment` for names. Conversation state lives in KV, not in
> the database.
>
> **Notes:**
> - KV key `session:CHATID` holds the saved step (step, userId,
>   activeBookingIds, selectedBookingIds, selectedItemIds,
>   startBookingId, cancelBookingId, pendingCancelItemIds,
>   createdAt). TTL 1 hour, renewed on each save.
> - The rate limit counters (`rl_telegram_webhook`, 30 per 60
>   seconds per chat) live in a Cloudflare rate limit binding, not
>   in KV or D1.
> - The `settings` table column `global_booking_note` is read on
>   start, see `start-booking-confirm.md`.
> - No R2 data is used. Return photos stay in Telegram and are
>   forwarded by file id.

```mermaid
erDiagram
    user ||--o{ telegram_link_token : has
    user ||--o{ booking : makes
    booking ||--o{ booking_item : contains
    equipment ||--o{ booking_item : "booked as"
    user {
        text id PK
        text telegram_chat_id "chat linked to the account"
        text telegram_username
        integer onboarding_complete
    }
    telegram_link_token {
        text token PK
        text user_id FK
        integer expires_at "10 minutes after creation"
    }
    booking {
        integer id PK
        text user_id FK
        integer start_time
        integer end_time
        text status "booked, active, returned, cancelled, overdue, partially_returned"
        integer started_at "set when picked up"
    }
    booking_item {
        integer id PK
        integer booking_id FK
        integer equipment_id FK
        text status "booked, active, returned, cancelled, overdue"
        integer returned_at
    }
    settings {
        text id PK
        text global_booking_note "sent to the member at pickup"
    }
    equipment {
        integer id PK
        text model_name
        text gcal_id
    }
```
