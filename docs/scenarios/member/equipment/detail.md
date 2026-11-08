# Equipment detail

## What does the detail page show?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant C as Google Calendar
    M->>B: Click Details on a card (/equipment/id)
    B->>W: getEquipmentByIdFn(id)
    W->>W: Active, required clearance at most the member's level, member clearance at least 2
    alt Not found or not allowed
        B-->>M: "Equipment not found"
    else Found
        B-->>M: Photo, description, category, clearance level
        B->>W: checkCalendarFreeBusy over the default next bookable window
        W->>C: Free/busy
        B-->>M: Badge Available or Unavailable, then the equipment calendar
    end
```

- The page has no booking button. Booking starts from the list, see [browse](browse.md).
- The badge uses the same default window as the list cards, see [availability](availability.md). Unlike the cards, a failed check shows "Unavailable".
- A missing, inactive or over-clearance item all show the same not-found message. A non-numeric id leaves a spinner.
- The photo is served from R2 through `/api/images/{imagePath}`, with a placeholder when missing or broken.
