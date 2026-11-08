# Equipment Categories List And Order

> **Question:** How do admins and managers see the equipment categories and change their order?
>
> **Answer:** The Categories tab of the Equipment area (/admin/equipment/categories) lists every category with its description and how many pieces of equipment it holds, ordered by its sort number and then its name. Dragging a row to a new place renumbers all categories from 0 in the new order and sends them to the server in one call. A toast says "Category order updated successfully". If saving fails the list jumps back to the old order and a toast says "Failed to update category order".
>
> **Notes:**
> - If the list cannot be loaded the page shows an empty list. The error is only logged.
> - The renumbering writes one row at a time, so a failure part way can leave some categories renumbered and the screen reverts to the old order until the page is reloaded.
> - Edit and Delete are in the menu at the end of each row.
> - Creating, editing and deleting a category are in [create-edit-category.md](create-edit-category.md) and [delete-category.md](delete-category.md).
> - The order set here is the order shown in the equipment filters and forms, see [../equipment/load-equipment-page.md](../equipment/load-equipment-page.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1

    Person->>Browser: open /admin/equipment/categories
    Browser->>Worker: getCategoriesWithCountFn()
    Worker->>D1: categories with equipment counts, by sort order then name
    alt load fails
        Note over Browser: error is logged only
        Browser-->>Person: empty list
    else loads
        Worker-->>Browser: categories with equipmentCount
        Browser-->>Person: sortable table
    end
    Person->>Browser: drag a row to a new place
    Browser->>Browser: show the new order at once
    Browser->>Worker: updateCategorySortOrderFn(id and new number for each)
    loop every category in the list
        Worker->>D1: set sort_order to its new position
    end
    alt saved
        Worker-->>Browser: success
        Browser-->>Person: toast "Category order updated successfully"
        Browser->>Browser: reload the page data
    else failed
        Browser->>Browser: put back the old order
        Browser-->>Person: toast "Failed to update category order"
    end
```
