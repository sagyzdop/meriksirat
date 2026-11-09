# Birthdays

The Birthdays tab lists upcoming birthdays of **Active** people who have one on file. Only Active counts (`BIRTHDAY_STATUSES`). One dedicated Google Calendar holds one all-day yearly event per such person; its ID is set in admin Settings, falling back to a built-in default.

## How are birthdays listed and kept in the calendar?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI
    participant W as Worker
    participant D1
    participant Cal as Birthday calendar

    A->>UI: open Birthdays (search, "wants congratulation" filter, sort)
    UI->>W: getUpcomingBirthdaysFn
    W->>D1: Active users with a parseable birthday
    W-->>UI: rows with next occurrence and age they turn, soonest first
    A->>UI: Sync to Calendar
    UI->>W: syncBirthdaysToCalendarFn
    W->>Cal: diff desired events against the calendar
    W->>Cal: create, update or delete events (matched by user ID in the description)
    W-->>UI: toast "Calendar synced: N created, N updated, N deleted"
```

- The same reconcile runs automatically when a member changes status ([list](list.md)), finishes onboarding or edits their profile. Failures there are logged, never blocking.
- Unparseable birthdays are skipped.
