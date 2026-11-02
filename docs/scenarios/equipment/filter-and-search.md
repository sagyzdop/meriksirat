# Searching and filtering equipment

> **Question:** How do search, category and "Show Available Only"
> narrow the equipment list?
>
> **Answer:** All narrowing happens in the browser on the list that was
> already loaded, so nothing is sent to the server when the member types
> or picks a category. Search waits 300 ms after typing stops and puts the
> text in the page address. Picking a category puts its id in the address
> and clears any search text. Search takes priority over category when
> both are present. With "Show Available Only" on, busy and inactive
> equipment is hidden once the availability check has finished.
>
> **Notes:**
> - Search is case-insensitive and matches the model name, the
>   description and the category name.
> - Items already in the booking being edited stay visible under
>   "Show Available Only", so the member can see they are included.
> - Category counts in the sidebar and dropdown count the whole loaded
>   list, not the filtered one. On phones the category list is a dropdown.
> - With no match, the page shows "No results found" and a hint to adjust
>   filters. With nothing loaded and no filter it shows "No equipment
>   available".
> - Date and time filters change the availability window, see
>   `check-availability.md`.
> - The filters live in the address, so reloading or sharing the link
>   keeps them.

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant B as Browser
    M->>B: Type in the search box
    B->>B: wait 300 ms after last keystroke
    B->>B: set searchQuery in the address (replace)
    alt Search text is not blank
        B->>B: keep items whose name, description<br/>or category contains the text
    else Category chosen
        M->>B: Pick a category
        B->>B: set categoryId, clear searchQuery
        B->>B: keep items of that category
    end
    opt Show Available Only is on and check finished
        M->>B: Switch on Show Available Only
        B->>B: set availabilityOnly in the address
        B->>B: drop inactive and busy items,<br/>keep items already in the booking
    end
    alt No items left
        B-->>M: "No results found"
    else Items left
        B-->>M: Cards grouped by category with counts
    end
```
