# ERD: bookings

Which tables hold bookings and their items? Source: `src/db/schema.ts`.

```mermaid
erDiagram
    user ||--o{ booking : makes
    booking ||--|{ booking_item : contains
    equipment ||--o{ booking_item : "is held in"
    booking {
        int id PK
        text userId FK
        ts startTime
        ts endTime
        text status "booked, active, returned, cancelled, overdue, partially_returned"
        text userEventDetails
        ts startedAt
        ts startReminderSentAt
        ts startWarningSentAt
        ts returnReminderSentAt
        ts graceWarningSentAt
    }
    booking_item {
        int id PK
        int bookingId FK
        int equipmentId FK
        text status "booked, active, returned, cancelled, overdue"
        text googleCalendarEventId
        ts returnedAt
    }
    equipment {
        int id PK
        text googleCalendarId
    }
    user {
        text id PK
        int cancelledInStartWindowCount
        int overdueCount
    }
```

- A booking's status is derived from its items and never set directly; `partially_returned` exists only on the booking ([GLOSSARY.md](../../../GLOSSARY.md)).
- Each item has one calendar event on its equipment's calendar.
- The four `*SentAt` columns make reminders idempotent ([every-5-min.md](../cron/every-5-min.md)).
- The two user counters are bumped once per booking by the auto-cancel and overdue steps.
- Deleting a booking cascades to its items.
