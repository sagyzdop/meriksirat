# State: album-listing

Key `album:list:{driveFolderId}`. Stored in the D1 `app_state` table (`src/lib/app-state.ts`), not in KV, since [ADR-0022](../../adr/0022-caches-and-flow-state-in-d1.md).

How does an album page avoid listing Drive folders on every view?

```mermaid
flowchart TD
    A[Album page, favorites or dashboard needs photos] --> B{Per-isolate memo or stored entry?}
    B -- none --> D[Check folder state and list each volume in Drive]
    B -- entry --> C{Fresh? 12 h, retry 15 min after a failure}
    C -- yes --> R[Read photos from the entry]
    C -- no --> D
    D --> E[write album:list:folder, TTL 8 days]
    E --> R
    X[Move, offload, remove or favorite remap] --> Y[delete album:list:folder]
```

- Value: JSON listing entry per source (`buffer:{volumeId}` and `flamekeeper:{volumeId}`): files, folder state, last check times. TTL 8 days (`LISTING_STORE_TTL_SECONDS`); a stale entry is served up to 7 days when Drive fails.
- Writer: `setCachedListing` from `loadAlbumListing` (`src/lib/albums/listing-server.ts`), only when the entry changed. Readers: the same function, `src/lib/favorites/functions.ts`, `src/lib/admin/functions/dashboard-stats.ts`. Invalidated in `remove.ts`, `storage-server.ts` and `favorites/remap-server.ts`.
- A 50-entry memo per Worker isolate holds the last written entry, so a failed write does not trigger another Drive listing. An entry larger than a D1 row is split across `part` rows.
- Elsewhere: the public album list page (edge Cache API, 10 minutes) and guest HTML in `server.ts`.
- Why: listing Drive costs outside requests and seconds; the cache also feeds the photo count and total bytes synced to `album` ([albums-and-storage](../erd/albums-and-storage.md)).
