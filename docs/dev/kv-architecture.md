# Workers KV

The project uses a single Cloudflare Workers KV namespace (`meriksirat_kv`) for two things:

1. **Telegram bot session storage** — multi-step wizard state during equipment return/pickup flows
2. **Google Drive folder listing cache** — protects the master account's Drive API quota

Rate limiting uses Cloudflare's native [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), not KV. See `src/lib/ratelimit.ts`.

---

## Binding

Declared in `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "meriksirat_kv",
    "id": "af581732fe484f5aa188c9814a1ea4dd",
  },
],
```

Typed as `KVNamespace` in `worker-configuration.d.ts` and `server.ts`.

---

## How KV is Accessed

Two patterns depending on the runtime context:

**Telegram handlers** — via `BotContext`:
```ts
ctx.env.meriksirat_kv
```

**TanStack Start server functions** — via dynamic import:
```ts
const { env } = await import('cloudflare:workers')
const kv = env.meriksirat_kv as KVNamespace
```

---

## Telegram Session Storage

**Core module:** `src/lib/telegram/kv-session.ts`

Stores wizard state for the equipment return and pickup flows. Each active Telegram user in a flow gets one key. Sessions expire after 1 hour via KV's `expirationTtl`.

### Key pattern

```
session:<chatId>
```

### CRUD functions

```ts
// src/lib/telegram/kv-session.ts
export async function getSession(kv: KVNamespace, chatId: string) {
  return await kv.get(`session:${chatId}`, 'json') as SessionData | null
}

export async function setSession(kv: KVNamespace, chatId: string, data: SessionData) {
  await kv.put(`session:${chatId}`, JSON.stringify({ ...data, createdAt: Date.now() }),
    { expirationTtl: 3600 })
}

export async function deleteSession(kv: KVNamespace, chatId: string) {
  await kv.delete(`session:${chatId}`)
}
```

### Session shape (`src/lib/telegram/types.ts`)

```ts
export interface SessionData {
  step?: 'awaiting_booking_selection' | 'awaiting_item_selection' | 'awaiting_photo'
    | 'awaiting_start_selection' | 'awaiting_start_confirm'
  userId?: string
  activeBookingIds?: number[]
  selectedBookingIds?: number[]
  selectedItemIds?: number[]
  startBookingId?: number
  photoPromptMessageId?: number
  createdAt?: number
}
```

### Lifecycle

A typical return flow: `setSession` (start) → `getSession` (each callback step) → `setSession` (advance) → `deleteSession` (photo received / flow complete). The start booking flow follows the same pattern. Menu navigation does not touch sessions — the TTL handles cleanup.

### Call sites

| Operation | File | Trigger |
|-----------|------|---------|
| `setSession` | `src/lib/telegram/commands/end-booking.ts` | `/return_equipment` — starts return flow |
| `setSession` | `src/lib/telegram/commands/start-booking.ts` | `/start_booking` — starts pickup flow |
| `setSession` | `src/lib/telegram/commands/callback.ts` | Booking/items selected — advance flow step |
| `getSession` | `src/lib/telegram/commands/callback.ts` | Every callback — restore flow state |
| `getSession` | `src/lib/telegram/commands/photo.ts` | Photo received — validate flow state |
| `deleteSession` | `src/lib/telegram/commands/callback.ts` | Flow complete or cancelled |
| `deleteSession` | `src/lib/telegram/commands/photo.ts` | Photo validated or failed |

---

## Album Listing Cache

**Core module:** `src/lib/albums/server.ts` (lines 113–186)

Caches Google Drive folder listings. Without this, every album page load (including public shared links) would hit the Drive API, quickly exhausting the master account's quota.

### Key pattern

```
album:list:<folderId>
```

TTL: 5 minutes (`LISTING_TTL_SECONDS = 300`). Mutations (upload, delete, restore, recreate) invalidate immediately via `delete`.

### Functions

```ts
// src/lib/albums/server.ts
export async function getCachedListing(folderId: string): Promise<CachedListing | null>
export async function setCachedListing(folderId: string, files: DriveFileMeta[], folderState?: AlbumFolderState): Promise<void>
export async function invalidateCachedListing(folderId: string): Promise<void>
```

### Cached shape

```ts
export interface CachedListing {
  folderState: AlbumFolderState  // 'ok' | 'trashed' | 'missing'
  files: DriveFileMeta[]
}
```

### Call sites

**Reads:**

| Consumer | File | When |
|----------|------|------|
| `listAlbumPhotos` | `src/lib/albums/functions.ts` | Album listing / detail page |
| Dashboard photo stats | `src/lib/admin/functions/dashboard.ts` | Admin dashboard |
| Dashboard folder health | `src/lib/admin/functions/dashboard.ts` | Admin dashboard |

**Writes / invalidations:**

| Trigger | File |
|---------|------|
| Cache miss after Drive API fetch | `src/lib/albums/functions.ts` |
| Album refresh | `src/lib/albums/functions.ts` |
| Folder recreated / restored / deleted | `src/lib/albums/functions.ts` |
| Upload session minted | `src/lib/albums/functions.ts` |
| Photo deleted | `src/lib/albums/functions.ts` |

---

## Free Tier Limits

| Metric | Limit |
|--------|-------|
| Reads/day | 100,000 |
| Writes to different keys/day | 1,000 |
| Writes to same key | 1/sec |
| Operations per Worker invocation | 1,000 |
| Storage | 1 GB |

Source: https://developers.cloudflare.com/kv/platform/limits/

With only two use cases (sessions + album cache), KV usage stays well within the free tier for normal traffic.

---

## What Does Not Use KV

- **Better Auth sessions** — stored in D1 via Drizzle
- **Rate limiting** — Cloudflare native Rate Limiting binding (`src/lib/ratelimit.ts`)
- **`window.sessionStorage`** — browser-only, used in `birthday-wish-drawer.tsx` and `splash-text.tsx`
- **Image concurrency gate** (`src/lib/albums/image-gate.ts`) — in-memory
- **Cron triggers** (`server.ts` scheduled handler) — no KV access
