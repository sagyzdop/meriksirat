# Calendar event titles

Each booking item has its own event in its equipment's calendar, in club time (Asia/Almaty). The description lists booking id, user, equipment, booked time, actual start and return when known, status in capitals and notes.

## What is an event's title at each step?

```mermaid
flowchart TD
    A["Create booking or add items"] -->|"item name - Booking"| B["Event"]
    B -->|"Member edit"| B1["item name - Booking"]
    B -->|"Admin edit"| B2["item name - Booking (STATUS)"]
    B -->|"Start pickup"| C["item name (ACTIVE), start = actual start"]
    C -->|"Extend 30 min"| C1["item name (STATUS), or plain item name if overdue was cleared"]
    C -->|"Clock: late past grace period"| D["item name (OVERDUE)"]
    C -->|"Return in the bot"| E["item name (RETURNED), end = return time"]
    D -->|"Return in the bot"| E
    B -->|"Cancel booking or item"| F["Event deleted"]
    B -->|"Start window missed (clock)"| F
```

- "item name" is the equipment model name, or "Equipment id" when it has none.
- Event start is the actual start once the booking has started, otherwise the booked start. End is the booked end, or the return time after a return.
- A member edit always writes "- Booking", even after the booking is no longer booked. The overdue event is written in UTC, which shows the same moment.
- The overdue and no-show steps are in [every 5 minutes](../../cron/every-5-min.md).
