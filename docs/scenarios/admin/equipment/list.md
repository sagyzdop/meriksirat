# Equipment list

Equipment (`/admin/equipment`) is the admin catalog. It shows active and inactive equipment, 50 per page, with filters, search (model name, description, category name) and sort kept in the URL. Admins and managers use it. Terms: [Equipment, Category, Clearance level](../../../../GLOSSARY.md).

## How does an admin edit equipment from the list?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI as Equipment table
    participant W as Worker
    participant D1

    A->>UI: change Category, Clearance Level or Status in a row
    UI->>W: updateEquipmentFn(equipmentId, one field)
    W->>D1: check the category exists (when changed)
    W->>D1: update the row
    W-->>UI: toast "Equipment updated", equipment queries invalidated

    A->>UI: tick rows
    alt Edit Clearance
        UI->>W: bulkUpdateEquipmentClearanceFn (level 1 to 10)
    else Edit Category
        UI->>W: bulkUpdateEquipmentCategoryFn
    else Edit Status
        UI->>W: bulkUpdateEquipmentStatusFn (Active or Inactive)
    else Delete
        UI->>W: bulkDeleteEquipmentFn
        W->>D1: delete rows with no booking item ever, skip the rest
        W-->>UI: toast "N deleted, M skipped (has bookings)"
    end
```

- Inactive equipment disappears from the member catalog but keeps its history. Clearance is the level a member needs to book it.
- Each row has a View link to the equipment's Google Calendar. Clicking a row opens the [edit form](form.md).
- Bulk edits write to every ticked id and report the ticked count. Ticks are by row position on the current page.
