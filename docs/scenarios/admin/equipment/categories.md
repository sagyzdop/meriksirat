# Categories

`/admin/equipment/categories` manages the groups used to filter the catalog. The table shows each category's equipment count.

## How do admins manage categories?

```mermaid
flowchart TD
    L["getCategoriesWithCountFn"] --> T["Table ordered by sort order, then name"]
    T --> C["Create: name (unique), description, sort order"]
    T --> E["Edit: same fields, name stays unique"]
    T --> R["Drag to reorder: updateCategorySortOrderFn"]
    T --> D["Delete: deleteCategoryFn"]
    D --> U["Find or create 'Uncategorized' (sort order 999)"]
    U --> M["Move the category's equipment to it"]
    M --> X["Delete the category"]
```

- Duplicate names are refused with "Category name already exists".
- Deleting never deletes equipment. The toast reports how many items moved to "Uncategorized".
- Members and bulk category edits use these same categories, see [Equipment list](list.md).
