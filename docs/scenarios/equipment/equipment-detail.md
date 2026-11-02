# Viewing one piece of equipment

> **Question:** What does a member see on an equipment detail page?
>
> **Answer:** The page shows the photo, description, category, required
> clearance level and an availability badge for the next free half hour,
> followed by a calendar of the item's events. If the item is missing,
> inactive, above the member's clearance, or the address is not a number,
> the member sees "Equipment not found" with a matching explanation.
>
> **Notes:**
> - The page has no booking button. The member goes back to the list to
>   select it, see `select-and-book.md`.
> - The badge uses the same window rule as the list cards, see
>   `check-availability.md`. Unlike the cards, a failed check shows
>   "Unavailable". Inactive equipment is "Unavailable" without a check.
> - The explanations are "Invalid equipment ID" for a bad address and
>   "The equipment you're looking for doesn't exist or you don't have
>   access to it." otherwise.
> - A member under clearance 2 gets nothing back and so sees the same
>   not-found message.
> - The calendar is described in `equipment-calendar.md`. The photo is
>   described in `equipment-images.md`.

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant C as Calendar
    M->>B: Click Details on a card
    alt Address is not a number
        B-->>M: "Equipment not found", "Invalid equipment ID"
    else Valid id
        B->>W: getEquipmentByIdFn(equipmentId)
        W->>D: read session user and clearance level
        alt Not signed in or clearance under 2
            W-->>B: nothing returned
            B-->>M: "Equipment not found"
        else Cleared member
            W->>D: read the equipment if active and<br/>required clearance at most member level
            alt No such row
                W-->>B: nothing returned
                B-->>M: "Equipment not found"
            else Found
                W-->>B: equipment with category
                B-->>M: Photo, details and badge "Checking…"
                B->>W: checkCalendarFreeBusy(calendarId, timeMin, timeMax)
                W->>W: require a signed-in user
                W->>C: free/busy query using master account token
                C-->>W: busy periods
                W-->>B: busy periods
                B-->>M: Badge "Available" or "Unavailable"
            end
        end
    end
```
