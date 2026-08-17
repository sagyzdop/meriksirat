# Photo Albums (Google Drive-backed gallery)

Albums are photo galleries whose files live in a **shared master Google Drive account**. The database stores album metadata only; every photo is a real Drive file inside a Drive folder. There is no separate storage — no upload bucket, no file table.

- Web pages: `/albums` (public gallery of shared albums), `/my-albums` (my albums), `/albums/<id>` (album view, can be public), `/admin/albums` (admin/manager oversight).
- Server functions: `src/lib/albums/functions.ts`.
- Data model & schemas: `src/lib/albums/types.ts`; DB tables in `src/db/schema.ts` (`album`, `album_member`, migration `0005`).
- Drive REST client: `src/lib/google/google-drive.ts`.
- Client upload engine: `src/lib/albums/upload-manager.ts` + `upload-storage.ts`.

## Drive layout

Every album is a folder inside the shared account:

```
Albums/
└── <year>/
    └── <month>/
        └── <album title>          ← one Drive folder per album
```

`createAlbumFn` resolves the `Albums/<year>/<month>` chain with `getOrCreateDriveFolder` (find by name, else create), then creates a new folder for the album title. Album folders are created with the master account, so the master's Drive quota is the only quota that matters.

**Every album folder is public in Google Drive.** `createAlbumFn` immediately grants the folder Drive's _anyone reader_ permission, so albums are always created public and stay public. The app's `is_shared` flag only controls whether the view link (`/albums/<id>`) works in the app — it never revokes the Drive permission. There is no way to make a folder private through the app anymore.

## Data model

| Table          | Purpose                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `album`        | id, owner user, title, description, `drive_folder_id`, `cover_file_id`, `edit_share_token`, `is_shared`, timestamps |
| `album_member` | co-author rows: an `(album_id, user_id)` membership with edit rights                                                |

Relations in `schema.ts` (`albumRelations`, `albumMemberRelations`, additions to `userRelations`). IDs and share tokens are generated URL-safe opaque strings in `src/lib/albums/ids.ts` (`newId(len)`, album id 10 chars, share token 24 chars).

## Access model

`resolveAlbumAccess(headers, albumRow)` in `server.ts` returns an access level, computed per request:

| Level     | Grant                                           |
| --------- | ----------------------------------------------- |
| `manager` | any `admin` or `manager` role user — highest    |
| `owner`   | the album's `owner_user_id`                     |
| `editor`  | an `album_member` row for the album (co-author) |
| `none`    | everyone else                                   |

`requireAccess(access, allowed)` throws `Insufficient permissions` when the acting level isn't in the allowed set. Permission gates live **inside each server function handler**; the client only uses the access level to hide/show UI.

Album-specific rules:

- **`getAlbumFn` / public view**: a non-shared album returns `null` (→ "Album not found") when the caller has `none` access. A _shared_ album is viewable by anyone.
- **Sharing**: `toggleAlbumShareFn` flips `is_shared`, which only controls whether the view link works in the app. The Drive folder always keeps its _anyone reader_ permission — folders are public in Drive by design so photos load straight from the CDN. Turning an album "private" never revokes Drive access; it just hides the album from the app's public view, so only the owner, co-authors, and managers can open it. Only managers/owners/editors may toggle.
- **Co-authors**: presenting an `?edit=<token>` link while logged in calls `claimEditAccessFn`, which verifies the token equals `edit_share_token`, then inserts an `album_member` row (`onConflictDoNothing`). Owners can't become their own member; the owner already has `owner` access.
- **Removal**: `removeMemberFn` lets managers/owners remove anyone; a co-author may only remove themself (`Leave album`).
- **Deletion**: `deleteAlbumFn` (managers/owners) deletes the Drive folder, invalidates the listing cache, and deletes the album row (members cascade).

## Folder health

A Drive folder can become unusable even though its album row still exists. `AlbumDetail.folderState` (`src/lib/albums/types.ts`) is one of:

| State     | Meaning                           | UI                                                                                                                 |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ok`      | folder exists and is usable       | normal                                                                                                             |
| `trashed` | folder sits in the Drive bin      | alert with **Restore folder** (`restoreAlbumFolderFn` → `restoreDriveFile`)                                        |
| `missing` | permanently deleted (photos gone) | destructive alert with **Recreate folder** (`recreateAlbumFolderFn` → new Drive folder, `drive_folder_id` updated) |

`listAlbumPhotos` detects the state by calling `getDriveFolderState` (a `files.get` with `trashed` field; a 404 → `missing`). The state is cached with the listing. `createUploadSessionFn` re-checks the state and rejects uploads when the folder isn't `ok`, so photos never silently land in an unreachable folder. Uploads are also disabled in the UI (`album-manager.tsx`) until the folder is restored/recreated.

## Photo listing & caching

`listAlbumPhotos` lists the folder with `listDriveFolderFiles` (pages through all results, `trashed=false`), keeps only `image/*` files, maps each to an `AlbumPhoto` (sorted by capture time), and returns it together with `folderState`.

The Drive folder listing is cached in **KV** (`meriksirat_kv`, key `album:list:<folderId>`, TTL 60s) because public album views hit the Drive API once per page load and shared links would otherwise hammer the master account's quota. Any mutation that changes the folder contents (upload session minted, photo deleted, folder deleted/recreated/restored) calls `invalidateCachedListing` immediately. The cache also stores `folderState`, so the trashed/missing state is served from cache too.

## Photo URLs & privacy

Album folders are always public in Google Drive (anyone reader), so `src/lib/albums/urls.ts` always serves photos straight from Google's CDN `lh3.googleusercontent.com/d/<fileId>=w<size>` — the `=wN` suffix resizes server-side for free, and thumbnails use `w600`. No Worker involvement, no quota, and no per-request access check on image loads. The `/api/drive-image` proxy was removed; `is_shared` only decides whether the album page is reachable in the app, not how photos are served.

Downloads (`src/lib/albums/download.ts`) use a plain anchor to Google's `drive.usercontent.com` export endpoint, which responds with `Content-Disposition: attachment` (no quota).

## Uploads

Uploads are **client-driven with a server-minted resumable session**:

1. `uploadManager.enqueue(albumId, albumTitle, files, existingNames)` dedupes against names already in the album and names already queued/in-flight for that album.
2. The upload manager mints a session per file via `createUploadSessionFn`, which checks access + folder state, rejects exact-name duplicates (`findDriveFileByName`), and calls `mintResumableUpload` to get Google's upload URL.
3. The browser **PUTs the file bytes straight to Google** via `XMLHttpRequest` (never through the Worker), reporting progress. `Content-Type: text/plain` avoids a CORS preflight; `mintResumableUpload` passes the browser `Origin` so Google binds the session's CORS to the right origin.

### The upload manager

`src/lib/albums/upload-manager.ts` is a **module singleton** — state lives outside React, so uploads keep running while navigating. Components subscribe via `useUploads()` (`useSyncExternalStore`). At most **2 uploads run concurrently** (`maxConcurrent`).

Jobs are **persisted** so uploads survive a page refresh:

- Job metadata → `localStorage` (`meriksirat.uploads.jobs.v1`).
- `File` payloads → **IndexedDB** (`meriksirat` / `upload-files`, keyed by job id).

On reload the manager rehydrates: interrupted `uploading` jobs restart from scratch as `queued`, `File` objects are recovered from IndexedDB, and jobs whose file can't be recovered fail with _"File is no longer available — choose it again"_. Rehydration briefly staggers the first start so rehydrated jobs don't pile onto the same Worker cold start as the page's own asset/SSR requests. Every state change persists. `retry` recovers the file and re-queues; `cancel` aborts the XHR and deletes the stored file.

Failures are **auto-retried** (up to 5 attempts, exponential backoff with jitter: ~1s/2s/4s/8s/16s) for transient errors — browser-level fetch failures (`Load failed`), XHR network errors/timeouts, and upload HTTP 408/429/5xx. The attempt counter is persisted, so repeated reloads can't loop forever; once the budget is exhausted the job settles in `error` and needs a manual retry. If the server rejects session minting with _"already exists in this album"_, the manager treats the job as `done` — a previous attempt of the same job reached Google's side but its result was lost (e.g. the page refreshed mid-upload).

Finished jobs **auto-expire** so the header widget and localStorage don't accumulate them forever: `done`/`cancelled` jobs drop after 1 hour, `error` jobs after 7 days (kept long enough to retry manually). A sweep runs on load and every minute. The header upload widget also shows an **×** per album to clear that album's finished jobs immediately.

`src/lib/albums/image-gate.ts` caps image fetch concurrency at 6 globally — the Drive CDN throttles bursts of anonymous thumbnail requests. `PhotoImage` (`src/components/albums/photo-image.tsx`) rides this gate and retries failed loads with backoff (up to 5 attempts) using `referrerPolicy="no-referrer"` to avoid CDN referer-based throttling.

### Upload UI

- **Dropzone** (`upload-dropzone.tsx`): drag & drop or file picker, per-job rows with status dots (queued / uploading % / done / error / cancelled), cancel/retry/clear-finished, aggregate progress bar. Surfaces a "skipped duplicates" notice.
- **Header widget** (`site-header.tsx`): groups jobs by album in a dropdown with per-album progress; clicking navigates to that album and opens its upload details (via `revealUploadDetails` + `useUploadReveal`).
- **Album page**: a floating progress button while uploads are active; once a batch finishes the album data invalidates and re-fetches automatically.

## Pages & components

| Route                          | Component(s)                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/albums/`                     | public gallery of shared albums (`albums/index.tsx`): `AlbumGroupedList`, optional `AuthenticatedShell` for logged-in users |
| `/_authenticated/my-albums/`   | `albums-page.tsx` (list + create dialog + `album-filter.tsx` combobox), `album-card.tsx`                                    |
| `/_authenticated/admin/albums` | same `albums-page.tsx` in `manage` mode (no create, shows all albums)                                                       |
| `/albums/$albumId`             | `album-page` route (`$albumId.tsx`): `album-manager.tsx`, `photo-grid.tsx`, `photo-lightbox.tsx`, uploads floating button   |

Album lists render grouped by creation year/month (`AlbumGroupedList` in `album-sections.tsx`, UTC, newest first — mirrors the `Albums/<year>/<month>` Drive layout). The public `/albums/` page and the anonymous view of `/albums/<id>` are wrapped in `PublicAlbumsLayout` (`public-layout.tsx`): a header with the club logo/"NU Image Albums" + "Made by sagyzdop", and a footer with Instagram/Telegram icon links. Anonymous visitors get a **Share** button that copies the album view link; logged-in visitors keep the immersive bare page (management UI shows when they have access).

The albums filter (`AlbumFilterSchema` in `types.ts`, enforced in `getMyAlbumsFn`) supports `all` / `owned` / `shared-by-me` / `shared-with-me` and lives in the URL search params (zod-validated). The album filter combobox uses the Base UI `Combobox` (`album-filter.tsx`) with `Button asChild` wrapping the default `ComboboxTrigger` so the built-in label + chevron render.

`photo-grid.tsx` renders a responsive square grid (each cell is a keyboard-accessible `role="button"`); hover reveals an action menu (set cover / download / delete) for managers. Clicking opens `photo-lightbox.tsx`, a Google Photos-style fullscreen viewer with auto-hiding chrome, arrow/escape keyboard nav, and a slide-in details drawer (name, position, type, size, date).

## Server functions (`src/lib/albums/functions.ts`)

| Function                | Access required                        | Purpose                                                            |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `createAlbumFn`         | logged in                              | create public Drive folder + album row (`is_shared` true)          |
| `getMyAlbumsFn`         | logged in (returns `[]` otherwise)     | filtered album summaries for the current user                      |
| `getPublicAlbumsFn`     | any (no auth)                          | all shared albums for the public `/albums` gallery                 |
| `getAllAlbumsFn`        | admin/manager                          | all albums for `/admin/albums`                                     |
| `getAlbumFn`            | any (shared) / album access            | full `AlbumDetail` incl. photos + folderState                      |
| `refreshAlbumFn`        | manager/owner/editor                   | invalidate listing cache and rebuild detail                        |
| `recreateAlbumFolderFn` | manager/owner                          | new Drive folder, rebind album                                     |
| `restoreAlbumFolderFn`  | manager/owner/editor                   | un-trash the Drive folder                                          |
| `updateAlbumFn`         | manager/owner/editor                   | update title/description; renames Drive folder in sync             |
| `deleteAlbumFn`         | manager/owner                          | delete folder + album (members cascade)                            |
| `toggleAlbumShareFn`    | manager/owner/editor                   | flip `is_shared` (app link only); Drive folder always stays public |
| `claimEditAccessFn`     | logged in + valid token                | become a co-author                                                 |
| `createUploadSessionFn` | manager/owner/editor                   | block if folder unhealthy, dedupe names, mint resumable upload URL |
| `deletePhotoFn`         | manager/owner/editor                   | delete Drive file (and clear cover if it was the cover)            |
| `setCoverPhotoFn`       | manager/owner/editor                   | set `cover_file_id`                                                |
| `removeMemberFn`        | manager/owner (anyone) / editor (self) | remove co-author / leave album                                     |

All handlers follow the repo's worker-import convention: `env`/`db`/schema/drive imports are `await import(...)` inside handlers (see `docs/dev/worker-import-convention.md`).

## Query keys

`src/lib/albums/queries.ts`:

| Key                           | Data                         |
| ----------------------------- | ---------------------------- |
| `['albums','public']`         | all shared albums (no auth)  |
| `['albums','mine',filter]`    | my album summaries, filtered |
| `['albums','manage']`         | all albums (admin)           |
| `['albums','detail',albumId]` | single album detail          |

Invalidate by the `albumQueries.all` prefix (`['albums']`) after any mutation. Album routes preload their query in the route loader via `ensureQueryData` (SSR-friendly), consistent with `docs/dev/data-loading.md`.

## Environment & bindings

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_MASTER_REFRESH_TOKEN` — the master Google OAuth client. `getGoogleAccessToken()` (`src/lib/google/google-calendar-auth.ts`) exchanges the refresh token for an access token per call.
- The Drive access token must include the `drive.file` scope. `scripts/google-mint-token.mjs` re-runs the OAuth consent flow to mint a refresh token with additional scopes.
- KV binding `meriksirat_kv` (`wrangler.jsonc`) backs the listing cache.
- The `cloudflare:workers` `env` is read lazily inside handlers (`cloudflare:workers` is a virtual worker-only module).
