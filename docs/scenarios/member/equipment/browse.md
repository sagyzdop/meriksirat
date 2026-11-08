# Browse and select equipment

`/equipment` is the member's home page and the entry to booking. Equipment is created and edited by admins, see the admin equipment docs.

## What does the equipment list contain?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    M->>B: Open /equipment
    B->>W: getEquipmentFn, getCategoriesFn, getBookingSettingsFn
    W->>D: Session user and clearance level
    alt No session or clearance under 2
        W-->>B: Nothing returned
        B-->>M: "No equipment available"
    else Cleared
        W->>D: Active equipment with required clearance at most the member's level
        W->>D: Categories by sort order, settings row (created if missing)
        W-->>B: Equipment, categories, operating hours
        B-->>M: Cards grouped by category with Details and Select
    end
```

- A member with no stored clearance counts as level 1, so sees nothing. The page is not blocked, only the list is empty.
- The list loads once with no filters. Search, category and availability filtering run in the browser. Filters live in the URL, so reload and shared links keep them.

## How do search, category and "Show Available Only" narrow the list?

```mermaid
flowchart TD
    A["Loaded equipment list"] --> B{"Show Available Only on and availability check finished?"}
    B -->|"Yes"| C["Drop busy items, keep items already in the booking being edited"]
    B -->|"No"| D["Keep all"]
    C --> E{"Search text not blank?"}
    D --> E
    E -->|"Yes"| F["Keep items whose name, description or category name contains it, case-insensitive"]
    E -->|"No"| G{"Category chosen?"}
    G -->|"Yes"| H["Keep that category"]
    G -->|"No"| I["Keep all"]
    F --> J{"Anything left?"}
    H --> J
    I --> J
    J -->|"No"| K["No results found"]
    J -->|"Yes"| L["Cards grouped by category with counts"]
```

- Search waits 300 ms after typing stops. Picking a category clears the search text. If both are set, search wins.
- Busy status comes from [availability](availability.md).

## How does a member go from the list to a booking?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    M->>B: Press Select on cards
    B->>B: Save ids in local storage key equipment-selection
    M->>B: Press "View & Book Selected"
    alt Normal mode
        B->>B: Open /bookings/new with equipmentIds
        Note over B: continues in ../bookings/create.md
    else Add-to-booking mode ("Add More" on a booking)
        B->>W: Free/busy for the selected items over the booking's window
        alt Any selected item busy
            B-->>M: Toast "NAME is not available during this booking's time window"
        else All free
            B->>B: Return to the booking page with equipmentIds
            Note over B: continues in ../bookings/edit.md
        end
    end
```

- A card marked "Unavailable" can still be selected in normal mode. The slot picker catches the conflict later.
- In add-to-booking mode the selection starts empty, items already in the booking are disabled, the button reads "Add to Booking", and the date and time filters are hidden because the window is the booking's own.
