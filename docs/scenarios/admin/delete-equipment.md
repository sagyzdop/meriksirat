# Delete Equipment

> **Question:** What happens when an admin or manager deletes a piece of equipment that has bookings?
>
> **Answer:** If any booking that is still booked, active, overdue or partly returned includes the item, it is not deleted. It is switched to inactive so it can no longer be booked and existing bookings carry on, and the page says so. If there is no such booking, the row is deleted for good. Either way the person sees a green message and is taken back to the equipment list.
>
> **Notes:**
> - The confirm dialog already warns about this: "If this equipment has active bookings, it will be marked as inactive instead of being deleted to preserve booking history."
> - After the inactive result the page waits 2 seconds before leaving, and after a real delete 1.5 seconds.
> - Only the booking statuses listed above count as active. Returned and cancelled bookings do not stop a delete.
> - Switching an item on again is done in [edit-equipment.md](edit-equipment.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1

    Person->>Browser: click Delete Equipment on the Edit page
    Browser-->>Person: dialog Delete Equipment with a warning
    Person->>Browser: click Delete Equipment in the dialog
    Browser->>Worker: deleteEquipmentFn(equipmentId)
    Worker->>D1: read the equipment
    alt not found
        Worker-->>Browser: error "Equipment not found"
        Browser-->>Person: red message with the error
    else found
        Worker->>D1: count items in booked, active, overdue<br/>or partly returned bookings
        alt count above 0
            Worker->>D1: set is_active = false
            Worker-->>Browser: action deactivated, message
            Browser-->>Person: green message "has been marked as inactive<br/>due to active bookings"
            Browser-->>Person: switch turns off, redirect after 2 s
        else count is 0
            Worker->>D1: delete the equipment row
            Worker-->>Browser: action deleted, message
            Browser-->>Person: green message "has been permanently deleted"
            Browser-->>Person: redirect to /admin/equipment after 1.5 s
        end
    end
    alt call failed
        Browser-->>Person: red message with the error or<br/>"Failed to delete equipment. Please try again."
    end
```
