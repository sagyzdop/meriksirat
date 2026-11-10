# Albums from before the buffer

Related: [refresh](refresh.md), [upload](upload.md), [ADR-0017](../../../adr/0017-drop-photo-table-read-from-drive.md).

## Does an older album behave differently?

No. It is read like any album from cached Drive listings. Photos in the album's root folder are listed with the master token, and photos a flamekeeper still holds are listed from that flamekeeper's volume.

```mermaid
sequenceDiagram
    autonumber
    actor U as Viewer
    participant W as Worker
    participant K as D1 app_state
    participant D as D1
    participant G as Drive
    U->>W: getAlbumFn(albumId)
    W->>K: Read album:list for each folder
    opt A section is due
        W->>G: List the folder with its holder's token
        W->>K: Save listing, TTL 8 days
        opt Every volume was listed completely
            W->>D: Album photo count and bytes = listing totals
        end
    end
    W-->>U: Photos from the listing
```

- There is no photo table and no indexer, so nothing has to be recorded before an old album works.
- Old flamekeeper and master volumes have no expected count, so they never raise the fewer-photos warning, see [warnings](warnings.md).
- Delete and cover work the same, but delete uses the holding flamekeeper's token, see [photos](photos.md).
