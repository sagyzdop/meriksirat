# Workers KV

The project uses a single Cloudflare Workers KV namespace (`meriksirat_kv`) for two things:

1. **Telegram bot session storage** — multi-step wizard state during equipment return/pickup flows
2. **Google Drive listing caches** — album listings and detail cores, protecting the master account's Drive API quota

Rate limiting uses Cloudflare's native [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), not KV (`src/lib/ratelimit.ts`).

## Binding

Declared in `wrangler.jsonc` as `kv_namespaces` → binding `meriksirat_kv`. Access patterns:

- **Telegram handlers**: `ctx.env.meriksirat_kv`
- **Server functions**: `const { env } = await import('cloudflare:workers')` inside the handler (worker-import convention)

KV free-tier limits: <https://developers.cloudflare.com/kv/platform/limits/>. With two use cases, usage stays well within the free tier.

## Key patterns

| Key                              | Contents                                                             | TTL                                                                                               | Written by                       |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| `session:<chatId>`               | Telegram wizard state (`SessionData` in `src/lib/telegram/types.ts`) | 1 hour (`expirationTtl`), deleted on flow completion                                              | `src/lib/telegram/kv-session.ts` |
| `album:list:<folderId>`          | Drive folder listing + `folderState`                                 | 5 min (`LISTING_TTL_SECONDS` in `src/lib/albums/server.ts`), invalidated on every folder mutation | `src/lib/albums/server.ts`       |
| (detail-core / public-page keys) | album detail and public page HTML caches                             | see `src/lib/albums/server.ts` constants                                                          | `src/lib/albums/server.ts`       |

Session lifecycle: `setSession` starts a flow, `getSession` restores it on each step, `deleteSession` clears it — menu navigation never touches sessions, the TTL handles cleanup. Album listing mutations (upload, delete, restore, recreate) call `invalidateCachedListing` immediately; `folderState` rides the same cache.

## What does not use KV

- **Better Auth sessions** — stored in D1 via Drizzle
- **Rate limiting** — Cloudflare native Rate Limiting binding (`src/lib/ratelimit.ts`)
- **`window.sessionStorage`** — browser-only (`birthday-wish-drawer.tsx`, `splash-text.tsx`)
- **Image concurrency gate** (`src/lib/albums/image-gate.ts`) — in-memory
- **Cron triggers** (`server.ts` scheduled handler) — no KV access
