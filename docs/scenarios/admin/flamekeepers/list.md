# Flamekeepers list

`/admin/flamekeepers` (Flamekeeper Management) lists every flamekeeper record for admins and managers.

## What can an admin do on the list?

```mermaid
flowchart TD
    P["/admin/flamekeepers"] --> Q["Load up to 500 rows, newest first, search by name or email"]
    Q --> F["Filter by status: Active, Full, Draining, Lost, Stopped, Banned"]
    Q --> S["Sort by name, status, pledged, used, graduation, created"]
    Q --> X["Export CSV of all rows matching the search and status filter"]
    Q --> R["Click a row: flamekeeper detail"]
    Q --> B{"Viewer is an admin?"}
    B -- yes --> BAN["Ban or Unban per row, and bulk Ban of selected rows"]
    B -- no --> N["Read only"]
```

- Status is the flamekeeper state, except a banned user shows Banned whatever their state. Status filtering, sorting and pagination run in the browser over the loaded rows; search is the only server-side filter.
- An admin cannot ban themselves. The ban dialogs and their effects are in the Club Members docs ([club-members](../club-members/)); a ban also ends flamekeeping at once ([ADR-0020](../../../adr/0020-member-status-separate-from-flamekeeper-state-and-ban.md)).
- Statuses are defined in the [GLOSSARY](../../../../GLOSSARY.md) (Flamekeeper).
