# Create, edit and delete equipment

Each piece of equipment is backed by its own Google Calendar. The admin pastes that calendar's ID; the app does not create calendars.

## How is equipment created?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI as /admin/equipment/new
    participant W as Worker
    participant D1
    participant R2

    A->>UI: model name, short name, description, category, calendar ID, clearance, optional image
    UI->>W: createEquipmentFn
    alt calendar ID already used
        W-->>UI: "Google Calendar ID already exists"
    else category missing
        W-->>UI: "Selected category does not exist"
    else ok
        W->>D1: insert (active)
        opt image chosen
            UI->>W: uploadEquipmentImageFn (JPEG, PNG or WebP, up to 5 MB)
            W->>R2: put equipment-images/{id}-{timestamp}.ext
            W->>D1: set image_path
        end
        UI-->>A: toast, back to the list
    end
```

- If the image upload fails, the equipment still exists; the toast says to add the image by editing.

## How is equipment edited or deleted?

```mermaid
flowchart TD
    E["/admin/equipment/:id/edit"] --> S["Save: updateEquipmentFn (same checks, calendar ID must stay unique)"]
    S --> I{"New image?"}
    I -->|"yes"| U["uploadEquipmentImageFn replaces image_path"]
    E --> D["Delete: deleteEquipmentFn"]
    D --> Q{"Booking with status booked, active, overdue or partially returned?"}
    Q -->|"yes"| X["Set Inactive, keep the row"]
    Q -->|"no"| Y["Delete the row"]
```

- Single delete only deactivates while open bookings exist. Past bookings do not block it. [Bulk delete](list.md) is stricter: any booking item ever blocks it.
- The old image object is not removed from R2 on replace.
