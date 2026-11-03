# Create Or Rename A Category

> **Question:** What happens when an admin or manager creates or edits an equipment category?
>
> **Answer:** The person presses Add Category, or opens a row's menu and picks Edit. In the Create New Category or Edit Category dialog they fill in a name, an optional description and a sort number (0 or more) and save. Names must be unique across all categories. A duplicate name shows the message "A category with this name already exists" under the name box. On success the dialog closes, a toast says "Category created successfully" or "Category updated successfully", and the list reloads.
>
> **Notes:**
> - The Create button is disabled while the name is blank. The Save button in the edit dialog is disabled while the name is blank or nothing has changed.
> - If the category was deleted by someone else while the edit dialog was open, the toast says "Category not found" and the dialog closes.
> - A blank description is stored as nothing (null). Names are compared exactly as typed after trimming spaces.
> - Any other error from the server is shown as a toast with its own message.
> - Ordering by dragging is in [categories-list.md](categories-list.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1

    Person->>Browser: click Add Category, or Edit in a row menu
    Browser-->>Person: dialog with name, description, sort number
    Person->>Browser: fill in and submit
    alt creating
        Browser->>Worker: createCategoryFn(name, description, sortOrder)
        Worker->>D1: look for a category with that name
        alt name taken
            Worker-->>Browser: error "Category name already exists"
            Browser-->>Person: "A category with this name already exists"
        else free
            Worker->>D1: insert category
            Worker-->>Browser: categoryId
            Browser-->>Person: toast "Category created successfully"
        end
    else editing
        Browser->>Worker: updateCategoryFn(categoryId, name, description, sortOrder)
        Worker->>D1: read the category
        alt not found
            Worker-->>Browser: error "Category not found"
            Browser-->>Person: toast "Category not found", dialog closes
        else another category has the name
            Worker-->>Browser: error "Category name already exists"
            Browser-->>Person: "A category with this name already exists"
        else ok
            Worker->>D1: update name, description, sort order
            Worker-->>Browser: success
            Browser-->>Person: toast "Category updated successfully"
        end
    end
    opt saved
        Browser->>Browser: close dialog, reload the page data
    end
```
