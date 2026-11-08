# Club Members list

Club Members (`/admin/members`) lists people with `isMember = true`. Admins and managers see it. The Birthdays and Violations tabs sit beside it. Terms: [Member status](../../../../GLOSSARY.md), [ADR-0020](../../../adr/0020-member-status-separate-from-flamekeeper-state-and-ban.md).

## How do admins find members and change their role, status or clearance?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI as Members table
    participant W as Worker
    participant D1
    participant Cal as Birthday calendar

    A->>UI: search, filter role/status/clearance, sort, page
    UI->>W: getAdminUsersFn (params live in the URL)
    W->>D1: members only, 50 per page, joined to flamekeeper state
    W-->>UI: rows + paging
    A->>UI: pick a new Role, Status or Clearance in a row
    UI->>W: updateUserAdminFn(userId, one field)
    alt manager or admin role, caller is not admin
        W-->>UI: refused
    else manager or admin role, target is not a member
        W-->>UI: refused
    else allowed
        W->>D1: update the field
        opt status changed
            W->>Cal: reconcile birthday events (errors logged only)
            opt new status is Inactive
                W->>D1: delete all sessions of the user
            end
        end
        W-->>UI: toast "Member updated"
    end
```

- Search matches first name, last name and email. Row click opens [the detail page](detail.md); clicks on selects, links and checkboxes do not.
- Role, status and clearance are inline selects. Manager and Admin options are disabled for managers in the UI and refused again on the server.
- Inactive signs the person out everywhere and blocks the next sign-in. Active, Inactive and Alumni are set by hand here.

## How does bulk clearance work?

```mermaid
flowchart LR
    A["Tick rows on the current page"] --> B["Edit Clearance (N)"]
    B --> C["Pick level 1 to 10"]
    C --> D["bulkUpdateUserClearanceFn"]
    D --> E["Same level written to every ticked member"]
    E --> F["Toast, ticks cleared, users list reloaded"]
```

- Clearance is the only bulk action on this table. Banning several people at once exists only on the [flamekeepers table](../flamekeepers/).
- Ticks are tracked by row position. After changing page, check the count on the button before confirming.
- The equipment table uses the same dialog, see [Equipment list](../equipment/list.md).
