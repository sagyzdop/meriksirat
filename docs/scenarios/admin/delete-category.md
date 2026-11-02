# Delete A Category

> **Question:** What happens to the equipment when an admin or manager deletes a category?
>
> **Answer:** The category is removed for good and every piece of equipment in it moves to a category named Uncategorized, which is created on the spot if it does not exist yet. The dialog warns about this beforehand. The toast says either "Category "name" deleted successfully" or, when equipment moved, "Category "name" deleted and N equipment items moved to "Uncategorized"". The list then reloads.
>
> **Notes:**
> - A new Uncategorized category gets the description "Default category for equipment without specific categories" and sort number 999, so it lands at the end.
> - If the category is already gone, the toast says "Category not found" and the dialog closes. Any other error is shown as its own toast.
> - The equipment move and the delete are separate steps, so a failure between them leaves the equipment moved and the category still present.

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1

    Person->>Browser: click delete on a category row
    Browser-->>Person: dialog Delete Category with equipment count
    Person->>Browser: confirm delete
    Browser->>Worker: deleteCategoryFn(categoryId)
    Worker->>D1: read the category
    alt not found
        Worker-->>Browser: error "Category not found"
        Browser-->>Person: toast "Category not found", dialog closes
    else found
        Worker->>D1: look for a category named Uncategorized
        opt none exists
            Worker->>D1: insert Uncategorized, sort number 999
        end
        Worker->>D1: move its equipment to Uncategorized
        Worker->>D1: delete the category
        Worker-->>Browser: success
        Browser-->>Person: toast saying deleted, and how many items moved
        Browser->>Browser: close dialog, reload the page data
    end
    alt other failure
        Browser-->>Person: toast with the error or "Failed to delete category"
    end
```
