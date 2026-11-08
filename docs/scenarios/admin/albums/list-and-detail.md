# Albums: list, detail and statuses

Manage Albums (`/admin/albums`) is for admins and managers. Terms: [Album status, Storage holder, Volume](../../../../GLOSSARY.md), [ADR-0018](../../../adr/0018-album-status-is-derived-with-six-statuses.md).

## How do admins browse albums?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI
    participant W as Worker
    participant D1

    A->>UI: search, filter status / storage / event date, sort, page
    UI->>W: admin album list
    Note over UI,W: no status chosen means Healthy, Unhealthy, Rescued, Scheduled for deletion
    W->>D1: albums with live volumes and flamekeeper state
    W->>W: derive status and storage holder per album
    W-->>UI: rows: title, event, owner, photos, size, status, storage (Buffer or Flamekeepers)
    A->>UI: open a row
    UI-->>A: /admin/albums/:id with Overview and Authors tabs
```

- Deleted and Lost albums are hidden until chosen in the status filter, and their detail page shows "Album not found".
- The detail page has the public album actions plus the admin actions in [storage.md](storage.md).

## What do the six statuses mean?

```mermaid
flowchart TD
    A["Album"] --> D{"Deleted?"}
    D -->|"yes, reason flamekeeper lost or left, or Drive folder deleted"| Lost
    D -->|"yes, other reason"| Deleted
    D -->|"no"| S{"Scheduled deletion date?"}
    S -->|"yes"| Sch["Scheduled for deletion"]
    S -->|"no"| R{"Rescued date?"}
    R -->|"yes"| Rescued
    R -->|"no"| U{"Live volume on a lost or partly lost flamekeeper?"}
    U -->|"yes"| Unhealthy
    U -->|"no"| Healthy
```

- Never stored; recomputed from the album and its volumes on every read.
- Storage is Flamekeepers if any live volume has a flamekeeper, Buffer if only buffer volumes are live, empty if none.
