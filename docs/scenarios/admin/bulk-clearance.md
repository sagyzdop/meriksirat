# Bulk Edit Clearance Level

> **Question:** How does an admin or manager set the clearance level for many members, or many pieces of equipment, in one go?
>
> **Answer:** The person ticks rows in the Members table or the Equipment table, presses Edit Clearance with the count, picks a level from 1 to 10 and presses Update All. The server sets that level on every ticked row. A toast says how many rows were updated, the ticks are cleared and the list reloads. For members the level is the clearance they hold. For equipment it is the clearance a member needs to book it.
>
> **Notes:**
>
> - Both tables share one dialog, titled Bulk Edit Clearance Level.
> - Ids that do not exist are silently ignored, and the count in the toast is the number of ticked rows.
> - The level starts unset, and the form blocks the submit until one from 1 to 10 is chosen.
> - An empty list of ids is refused with "No user IDs provided" or "No equipment IDs provided". The Edit Clearance button appears only once at least one row is ticked.
> - Only rows on the current page can be ticked. The ticks are remembered by row position, not by person, so after changing page the same positions can still be ticked and would then name different people. Look at the count on the Edit Clearance button before confirming.
> - Clearance gates which equipment a member sees and can book, see [../equipment/load-equipment-page.md](../equipment/load-equipment-page.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1

    Person->>Browser: tick rows, click Edit Clearance (N)
    Browser-->>Person: dialog Bulk Edit Clearance Level
    Person->>Browser: choose a level 1 to 10, click Update All
    alt members table
        Browser->>Worker: bulkUpdateUserClearanceFn(userIds, level)
        alt no ids
            Worker-->>Browser: error "No user IDs provided"
        else ids given
            Worker->>D1: set clearance_level on those users
            Worker-->>Browser: success, count
        end
    else equipment table
        Browser->>Worker: bulkUpdateEquipmentClearanceFn(equipmentIds, level)
        alt no ids
            Worker-->>Browser: error "No equipment IDs provided"
        else ids given
            Worker->>D1: set required_clearance_level on that equipment
            Worker-->>Browser: success, count
        end
    end
    alt succeeded
        Browser-->>Person: toast "Updated clearance level for<br/>N member(s)" or "N equipment item(s)"
        Browser->>Browser: clear ticks, refresh users or equipment admin-list queries
    else failed
        Browser-->>Person: toast "Failed to update members" or<br/>"Failed to update equipment" with the reason
    end
```
