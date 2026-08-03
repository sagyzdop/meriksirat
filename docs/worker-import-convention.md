# Server-only Imports in a Shared Codebase

When code is shared between the browser and the Cloudflare Workers runtime, a naive import can silently leak server-only code into the client bundle. This document defines the terms, states the convention this repo follows, and explains why.

## The rule in one sentence

**Anything a browser page can reach (server functions, components, routes) must never statically import a module that needs the Workers runtime — those imports belong inside server-function handlers via `await import(...)`.**

## Definitions

- **Server function** — a function created with `createServerFn` (from `@tanstack/react-start`). It is an RPC endpoint: callable from the browser, executed on the server. The same source file is compiled **twice**:
  - **Server bundle** — the deployed Cloudflare Worker; contains the real handler logic.
  - **Client bundle** — the JavaScript shipped to the browser; the `.handler()` body is stripped and replaced with a stub that fetches the server.
- **Server bundle / client bundle** — the two artifacts produced for the two runtimes. A module ends up in the client bundle if any client-reachable module statically imports it.
- **Client-reachable module** — any module in the transitive static-import graph of a client component or route. Example: `src/components/root/app-sidebar.tsx` statically imports `@/lib/auth/session`, so everything `session.ts` statically imports is client-reachable.
- **Worker-only module** — a module that can only be evaluated inside the Workers runtime. The canonical case is `cloudflare:workers`, a **virtual module** Cloudflare injects that exposes `env` (runtime bindings: the `D1Database`, secrets, etc.). It does not exist for the browser — Vite cannot resolve it. Any module that statically imports it (directly or transitively) is itself worker-only.
- **Static (top-level) import** — `import { x } from '...'`. Evaluated when the module loads; the bundler includes it in whatever bundle the importer lands in. If a client-reachable file statically imports a worker-only module, the client build tries to resolve it and fails.
- **Dynamic (lazy) import** — `const { x } = await import('...')`. Fetched at runtime as a separate chunk. Inside a server-function handler it is harmless to the client build, because the handler body — and therefore the `await import(...)` — is stripped from the client bundle entirely.
- **Tree-shaking** — the bundler (Rollup/Vite) dropping unused imports and exports. If a worker-only import is only referenced inside a stripped handler body, the bundler can prove the import is unused and removes it — **which is why leaks currently "happen to work".** Relying on this is fragile: the moment the import is referenced at module scope (outside a handler), it is no longer removable and the client build breaks.

## Why `@/lib/auth/auth` is special

`src/lib/auth/auth.ts` constructs the `betterAuth(...)` instance at **module scope** and passes `env.meriksirat_d1` into it (line 18). Because `env` is read at load time, this module *can never* be bundled for the client, and tree-shaking cannot save it. It is therefore consumed **only** via `await import('@/lib/auth/auth')` inside handlers, or by server-only modules.

## The convention

Inside every server-function `.handler()`:

```ts
.handler(async ({ data }) => {
  const headers = getRequestHeaders()               // client-safe: OK at top level
  const { auth } = await import('@/lib/auth/auth')  // worker-only: lazy
  const { env } = await import('cloudflare:workers')// worker-only: lazy
  const { db } = await import('@/db')               // server-side: lazy
  const { schema } = await import('@/db/schema')    // server-side: lazy
  const { eq } = await import('drizzle-orm')        // server-side: lazy
  ...
})
```

At the **top level** of a client-bundled module, keep only client-safe imports (zod schemas, types, `@tanstack/react-start`, `@tanstack/react-start/server`).

Modules that are guaranteed **server-only** (imported only from API routes or other server modules — e.g. `src/routes/api/*`, `src/lib/telegram/*`) may use top-level imports freely; they never reach the browser. `@/lib/admin/server` and `@/lib/booking/server` fall in this class and are additionally always consumed via `await import(...)`.

## Current status

| File | Client-reachable? | Pattern |
| ---- | ----------------- | ------- |
| `src/lib/equipment/functions.ts` | yes | lazy imports in handlers; `getUserClearanceLevel` is a static top-level import of a client-safe module |
| `src/lib/equipment/server.ts` | via `functions.ts` | client-safe (its only `cloudflare:workers` usage is a lazy import) |
| `src/lib/user/functions.ts` | yes | lazy imports in handlers |
| `src/lib/admin/functions.ts`, `settings.ts` | yes | lazy imports in handlers |
| `src/lib/booking/functions/*` | yes | lazy imports in handlers |
| `src/lib/auth/session.ts` | yes (`app-sidebar.tsx`) | lazy `auth` import in handler |
| `src/lib/auth/onboarding.ts` | yes (`onboarding/index.tsx`) | lazy imports in all 3 handlers |
| `src/lib/auth/auth.ts` | never | module-scope `env`; consumed only dynamically |
| `src/lib/admin/server.ts` | no | top-level (only imported via `await import()` in handlers) |
| `src/lib/telegram/commands/start.ts` | no | top-level worker imports; server route only |
| `src/lib/telegram/{context,logging,server-utils}.ts` | no | top-level worker imports; server only |
| `src/lib/booking/server.ts` | no | top-level; **currently imported nowhere** (possibly dead) |

## Incidents fixed

- **`src/lib/equipment/server.ts`** — previously imported `env` from `cloudflare:workers` at the top level while `functions.ts` statically imported it. Moved to a lazy import inside `getUserClearanceLevel` so the module is client-safe and can be a normal top-level import.
- **`src/lib/auth/session.ts`** — imported `auth` at the top level while being statically imported by a client component. Now lazy-imports `auth` inside the handler.
- **`src/lib/auth/onboarding.ts`** — imported `auth`, `env`, `db`, schema, and `drizzle-orm` at the top level while being statically imported by a client component. All moved into lazy imports inside each of the three handlers.

## How to verify

Build the app, then assert the client bundle contains no worker-only references:

```sh
npm run build
rg -c "cloudflare:workers" dist/client/assets/   # expect 0
```

The one legitimate `better-auth` reference in the client bundle comes from `src/lib/auth/auth-client.tsx` (`createAuthClient` from `better-auth/react`, the browser-side auth client) — that is client code by design and not a violation.
