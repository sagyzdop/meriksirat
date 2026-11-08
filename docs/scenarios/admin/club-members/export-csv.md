# Export members to CSV

## How does an admin export members?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI as Dashboard header, Export Members
    participant W as Worker
    participant D1

    A->>UI: open Export Members
    A->>UI: tick columns (15 available, all ticked by default)
    UI->>W: exportUsersFn (cached in the browser)
    W->>D1: all matching users, ordered by first name
    W-->>UI: rows
    UI->>UI: build CSV in the browser, download members-export.csv
    UI-->>A: toast "Exported N members"
```

- The button is in the dashboard header menu and passes no filters, so every user is exported, including non-members. The server accepts role, status, clearance and search filters, but no screen sets them.
- At least one column must stay ticked.
- Columns: full name, email, role, status, clearance, NU ID, Instagram, Telegram, major, graduation year, birthday, member since, auto-cancelled, overdue, albums.
