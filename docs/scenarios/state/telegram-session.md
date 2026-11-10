# State: telegram-session

Key `session:{chatId}`. Stored in the D1 `app_state` table (`src/lib/app-state.ts`), not in KV ([ADR-0022](../../adr/0022-caches-and-flow-state-in-d1.md)).

What does the bot remember between messages of a flow?

```mermaid
sequenceDiagram
    participant U as Member in Telegram
    participant B as Bot command or text router
    participant K as app_state session:chatId
    U->>B: Start, Return or Cancel booking
    B->>K: write step + selected ids, TTL 1 hour
    U->>B: reply keyboard choice or photo
    B->>K: get session
    K-->>B: step, userId, booking and item ids
    B->>K: write next step (TTL restarts)
```

- Value: JSON `SessionData` with `step` (`awaiting_booking_selection`, `awaiting_item_selection`, `awaiting_photo`, `awaiting_start_selection`, `awaiting_start_confirm`, `awaiting_cancel_selection`, `awaiting_cancel_items`, `awaiting_cancel_confirm`), `userId`, the booking and item ids chosen so far, and `createdAt`.
- TTL: 3600 s, restarted on each write. There is no delete; an abandoned flow expires.
- Writers: `src/lib/telegram/commands/{start-booking,end-booking,cancel-booking,text-router}.ts` through `setSession`. Readers: `text-router.ts` and `photo.ts` through `getSession` (`src/lib/telegram/session.ts`).
- Why stored: a Telegram update is a stateless webhook call. It is in D1 so a return, start or cancel flow never fails on the KV daily write quota.
