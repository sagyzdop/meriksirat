# Equipment calendar view

> **Question:** How does the calendar on the equipment detail page get
> its events?
>
> **Answer:** The calendar opens on a week view, with a month view
> available, and cannot be edited. Whenever the visible range
> changes, the browser asks the server for the events of that item's
> Google calendar in that range and draws them. If loading fails the
> member sees the toast "Failed to load calendar events".
>
> **Notes:**
> - The server reads the calendar with the club's master Google
>   account, for any signed-in user. At most 250 events are returned
>   per request, ordered by start time, with repeating events
>   split into single events. Events beyond 250 are not shown.
> - A spinner shows only while loading and nothing is drawn yet.
> - A legend under the calendar names the item.
> - If the range changes while a request is running, the older
>   answer is dropped.
> - Cancelled events are not drawn. All-day events are drawn as
>   all-day. An event with no title shows "(no title)".
> - The same toast appears whatever the cause. The browser only logs
>   the server's error text.

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant B as Browser
    participant W as Worker
    participant C as Calendar
    B-->>M: Empty week view with spinner
    B->>B: work out visible start and end
    B->>W: getCalendarEvents(equipmentCalendarId,<br/>timeMin, timeMax)
    W->>W: require a signed-in user
    alt Not signed in
        W-->>B: error "Not authenticated"
        B-->>M: Toast "Failed to load calendar events"
    else Signed in
        W->>C: list events, up to 250, using master account token
        alt Google returns an error
            C-->>W: error
            W-->>B: error "Failed to get calendar events"<br/>followed by Google's text
            B-->>M: Toast "Failed to load calendar events"
        else Events returned
            C-->>W: events
            W-->>B: events
            B-->>M: Events drawn on the calendar
        end
    end
    M->>B: Switch week or month, or move forward or back
    B->>W: getCalendarEvents(...) for the new range
```
