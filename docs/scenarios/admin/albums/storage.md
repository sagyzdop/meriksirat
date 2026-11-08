# Albums: move storage and schedule deletion

Actions on one album (detail page) or on ticked rows (table, up to 200). They run through `previewAlbumMovesFn`, which sets what can move before anything is touched. A volume holds at most 256 MB, so an album can span several volumes ([ADR-0019](../../../adr/0019-256mb-volumes-several-per-holder.md)).

## How does Move to Buffer work?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant UI as Move to Buffer dialog
    participant W as Worker
    participant FK as Flamekeeper Drive
    participant Buf as Buffer Drive
    participant D1

    A->>UI: Move to Buffer (N)
    UI->>W: previewAlbumMovesFn(target buffer)
    W-->>UI: movable vs skipped (deleted, no storage record, already on buffer)
    A->>UI: Confirm
    UI->>W: moveAlbumsToBufferFn
    W->>Buf: copy each volume's files with the full buffer token, verify count, size and MD5
    W->>FK: delete the originals with the flamekeeper's own token
    W->>D1: replace volume rows, set rescued date, remap favorites and cover
    W-->>UI: toast "Moved N albums to the Buffer", skipped ones listed with reasons
```

- Runs on the server within a request budget; an album that does not finish is reported and can be retried.
- Fails with "The buffer is full" when the buffer lacks room.

## How does Move to Flamekeepers work?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant B as Admin's browser
    participant W as Worker
    participant Buf as Buffer Drive
    participant FK as Flamekeeper Drive

    A->>B: Move to Flamekeepers (N)
    B->>W: previewAlbumMovesFn(target flamekeeper)
    W-->>B: planned volumes per active flamekeeper, or "No flamekeeper has room"
    B->>W: startOffloadFn
    W->>FK: create volume folders, share them
    W-->>B: file list, buffer download token, upload URLs
    loop each file
        B->>Buf: download
        B->>FK: upload (8 MB chunks, retried)
    end
    B->>W: completeOffloadFn
    W->>W: verify copies, remap favorites and cover
    W->>Buf: delete originals
    W->>W: swap volume rows, clear rescued date
```

- Only albums held by the buffer move. The button shows only when `VITE_ENABLE_ALBUM_OFFLOAD=true`.
- The admin keeps the browser open. Progress is kept for 6 hours in KV (`album:offload:{id}`), so a stopped move can be restarted and skips files already uploaded. Photos get new Drive file IDs ([Relay](../../../../GLOSSARY.md)).
- Destinations are Active flamekeepers with a Drive grant, within their pledge and the pool cap ([flamekeepers](../flamekeepers/)).

## How do admins schedule an album for deletion?

```mermaid
flowchart TD
    S["Schedule deletion (one or many)"] --> D["Date = today + 'album deletion notice days' from Settings (default 14)"]
    D --> W["scheduleAlbumsDeletionFn: albums not deleted and not yet scheduled"]
    W --> N["Telegram notice to owner and everyone who favorited, with the date"]
    W --> St["Status: Scheduled for deletion"]
    St --> C{"Cancel deletion before the date?"}
    C -->|"yes"| K["cancelAlbumsDeletionFn clears the date"]
    C -->|"no"| H["Hourly deleteScheduledAlbums removes it (3 per run)"]
```

- Already scheduled albums are skipped. Users without a linked Telegram chat get no notice.
- Deleting itself follows the normal album removal, see [cron](../../cron/). There is no automatic expiry any more; every deletion starts here.
