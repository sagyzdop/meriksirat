# Members And Alumni Lists

> **Question:** How do admins and managers browse, search and filter club members and alumni?
>
> **Answer:** Manage Users has three tabs. Members lists club members with their role, status, clearance level and album count, and a Flamekeeper badge on those who are flamekeepers. Alumni lists accounts whose email ends in @alumni.nu.edu.kz, member or not. Flamekeepers is covered elsewhere. Both lists filter, search and sort on the server, keep their settings in the address bar and show 50 rows per page. Clicking a row opens the person's detail page.
>
> **Notes:**
> - The Members list shows only people marked as club members. The Members filters are role, status and clearance level. Search matches the name, email, first name and last name fields.
> - The Alumni list has search and sorting by name, email and joined date, and shows a Member badge when the account is also a club member.
> - Page, size, filters and sort are part of the URL, so a link or a reload keeps them. Changing a filter reloads the list through the same function.
> - Changing a role, status or clearance from the Members table is in [change-member.md](change-member.md). Clearance for many rows at once is in [bulk-clearance.md](bulk-clearance.md).
> - The Flamekeepers tab is in [../flamekeepers/admin-flamekeepers.md](../flamekeepers/admin-flamekeepers.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1

    Person->>Browser: open /admin/users
    Browser->>Worker: getAdminUsersFn(role, status, clearance, search, page, sort)
    Worker->>D1: users who are club members, filtered and sorted
    Worker->>D1: count matching rows
    Worker-->>Browser: users with flamekeeper state and paging info
    Browser-->>Person: "Managing N users" or "No users found",<br/>and the table
    Person->>Browser: click the Alumni tab
    Browser->>Worker: getAdminAlumniFn(search, page, sort)
    Worker->>D1: users whose email is an alumni address
    Worker->>D1: count matching rows
    Worker-->>Browser: alumni rows with isMember
    Browser-->>Person: alumni table
    Person->>Browser: change filter, search, sort or page
    Browser->>Browser: update the URL search values
    Browser->>Worker: same list function with new values
    Worker-->>Browser: new page
    alt list call fails
        Note over Browser: error is logged only
        Browser-->>Person: empty table
    end
    Person->>Browser: click a row or a name
    Browser-->>Person: open /admin/users/userId
    Note over Browser: see member-detail.md
```
