# Edit Equipment

> **Question:** What happens when an admin or manager edits a piece of equipment, switches it off or replaces its photo?
>
> **Answer:** The Edit page loads the item and the category list, and the person changes any field, the Active switch or the image, then presses Save Changes. The server checks that the item exists, that a changed calendar ID is not used by another item and that the category exists, then saves. A green message says the item was updated, and after 1.5 seconds the page goes to the equipment list. Inactive equipment cannot be booked by members.
>
> **Notes:**
> - The text of the green message tells the outcome: updated, updated with new image, or updated but the image upload failed (the person can try the image again).
> - Changing the image uploads a new file to R2 and points the item at it. The previous file stays in R2.
> - The page does not refresh any list. The list page loads its own data when opened.
> - If the item is missing when the page opens, the page shows "Failed to load equipment data".
> - Deleting from this page is in [delete-equipment.md](delete-equipment.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1
    participant R2

    Person->>Browser: click Edit on a row
    Browser->>Worker: getAdminEquipmentByIdFn(equipmentId)
    Worker->>D1: read equipment with its category
    Browser->>Worker: getCategoriesFn()
    Note over Browser,Worker: category choices, see ../equipment/
    alt equipment not found
        Browser-->>Person: error "Failed to load equipment data"
    else loaded
        Browser-->>Person: form filled with current values
    end
    Person->>Browser: change fields, Active switch or image, click Save Changes
    Browser->>Worker: updateEquipmentFn(equipmentId, fields, isActive)
    alt equipment not found
        Worker-->>Browser: error "Equipment not found"
    else calendar id used by another item
        Worker-->>Browser: error "Google Calendar ID already exists.<br/>Each equipment must have a unique calendar."
    else category does not exist
        Worker-->>Browser: error "Selected category does not exist"
    else saved
        Worker->>D1: update equipment
        opt a new image was chosen
            Browser->>Worker: uploadEquipmentImageFn(equipmentId, base64, type)
            Worker->>R2: put equipment-images/id-time.ext
            Worker->>D1: set image_path
        end
        Browser-->>Person: green message for updated, with new image, or image failed
        Browser-->>Person: redirect to /admin/equipment after 1.5 s
    end
    alt any step failed
        Browser-->>Person: red message with the error or<br/>"Failed to update equipment. Please try again."
    end
```
