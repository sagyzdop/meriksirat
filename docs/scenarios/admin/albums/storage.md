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
    W->>FK: list each volume with the full buffer token (and with the flamekeeper's token when reachable, to check the buffer sees every file)
    W->>Buf: copy into staged buffer volumes (dropped rows), verify name, size and MD5, delete duplicate copies
    W->>D1: one batch: staged volumes live, flamekeeper volumes dropped, rescued date, used bytes released
    W->>W: remap favorites and cover
    W->>FK: delete the originals with the flamekeeper's own token (cleanup of dropped volumes)
    W-->>UI: toast "Moved N albums to the Buffer", skipped ones listed with reasons
```

- Shown on one album only when flamekeepers hold it; the bulk button is always there and the preview skips what does not apply.
- Runs on the server within a request budget. An album that does not finish says so; running it again continues from the copies already made (an `app_state` marker `album:rescue:{id}` keeps them from being cleaned up meanwhile, [album-offload](../../state/album-offload.md)).
- A lost flamekeeper's photos can still be copied, since the volume folder is shared with the buffer. Their originals stay in their Drive until they reconnect, then the cleanup deletes them.
- Fails with "The buffer is full" when the buffer lacks room, and refuses when the buffer cannot read a volume folder.

## How does Move to Flamekeepers work?

```mermaid
sequenceDiagram
    actor A as Admin or manager
    participant B as Admin's browser
    participant W as Worker
    participant K as app_state album:offload:id
    participant Buf as Buffer Drive
    participant FK as Flamekeeper Drive
    participant D1

    A->>B: Move to Flamekeepers (N)
    B->>W: previewAlbumMovesFn(target flamekeeper)
    W-->>B: planned volumes per active flamekeeper, or "No flamekeeper has room"
    loop each album, one at a time
        B->>W: startOffloadFn(album)
        W->>Buf: list the buffer volumes
        W->>K: plan: files packed into volumes of at most 256 MB, each assigned a flamekeeper
        W-->>B: file list and a buffer drive.file download token
        loop batches of 20 files
            B->>W: mintOffloadUploadsFn
            W->>FK: first time per volume: master creates the folder in the album folder, shares it (writer to the flamekeeper, reader to the buffer), dropped volume row
            W->>FK: list the folder, mark files already there
            W-->>B: resumable upload URLs minted with the flamekeeper's token
            B->>Buf: download, check MD5
            B->>FK: upload in 8 MB chunks, retried
        end
        loop until done (each call within the request budget)
            B->>W: completeOffloadFn
            W->>FK: verify each volume holds every planned photo (name, size, MD5)
            W->>Buf: check no new photo arrived, note photos deleted meanwhile
        end
        W->>FK: delete duplicate copies and copies of deleted photos
        W->>D1: one batch: flamekeeper volumes live with expected count and bytes, buffer volumes dropped, used bytes added
        W->>W: remap favorites and cover, Full when no room is left
        W->>Buf: delete the originals (cleanup of dropped volumes)
    end
```

- Shown on one album only when the buffer holds it. Destinations are Active flamekeepers with a Drive grant, within their pledge and the per-account cap ([flamekeepers](../flamekeepers/)).
- The admin keeps the browser open; closing the tab is warned. Cancel stops after the current file. Retry unfinished, within 6 hours, reuses the plan and skips files already uploaded; photos deleted meanwhile are dropped from the plan. A plan that no longer fits (new photos, a flamekeeper gone or full) is replaced, and the old partial copies are removed by the hourly cleanup.
- Uploads to the album are refused while the move runs and after it, as an album is held by the buffer or by flamekeepers, never both ([ADR-0019](../../../adr/0019-256mb-volumes-several-per-holder.md)). Move it back to the buffer to add photos.
- Photos get new Drive file IDs ([Relay](../../../../GLOSSARY.md)). They stay public: the volume folders sit in the album folder, which anyone can read ([ADR-0005](../../../adr/0005-album-drive-folders-are-always-public.md)).
- The buffer download token is the buffer's `drive.file` access token and is refreshed when it expires mid-move.

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
