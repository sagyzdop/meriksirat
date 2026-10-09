# AGENTS.md

Full-stack equipment booking platform: React 19 / TanStack Start (file-router) + Cloudflare Workers, D1 + Drizzle ORM, R2, KV. SSR runs in the Worker via `server.ts`.

## Commands

- `npm run dev` — apply local migrations, build, then `wrangler dev` on :3000 (this is the real dev loop; `dev:vite` is only the UI shell).
- `npm run test` — `vitest run`, node environment, plain unit tests only (see `src/tests/*.test.ts`). No DB/integration tests.
- `npm run lint` — **broken at baseline** (exits 1 on prettier/prettier formatting errors across many files). Do not treat output as actionable; `lint:fix` may rewrite files.
- `npx tsc --noEmit` — must stay clean (0 errors at baseline).
- Format touched files with `npx prettier --write` (no semi, single quotes, width 80).
- `npm run db:generate` — writes a new migration into `migrations/` (the script hardcodes `--name setup`, so every migration is named `setup` and numbered sequentially — don't rename them); then `db:migrate-local` / `db:migrate-remote`.
- `npm run build` then `rg -c "cloudflare:workers" dist/client/assets/` and expect 0 — the client-bundle leak check.
- `npm run deploy` — build + `wrangler deploy`.

## Worker import convention (critical)

`createServerFn` handler bodies are compiled twice (server Worker + client stub). Anything client-reachable must NOT statically import worker-only modules (`cloudflare:workers`, `@/lib/auth/auth`, `@/db`, `@/db/schema`, `drizzle-orm`). Worker-only imports go inside handlers via `await import(...)`. Rule of thumb: a browser-reachable file's top-level imports must be client-safe (zod, types, react-start). Modules only imported from `src/routes/api/*` or `src/lib/telegram/*` may use top-level worker imports freely.

## Data loading (TanStack Query + SSR)

- Every list/detail page routes through `queryOptions` factories in `src/lib/{equipment,booking,user}/queries.ts`. Query keys: `['equipment', ...]`, `['bookings', ...]`, `['users', ...]`.
- Route loaders preload via `context.queryClient.ensureQueryData(...)`; mutations call server functions then invalidate by **prefix** (`invalidateQueries({ queryKey: ['equipment'] })`), never exact keys.
- Search params (pagination/filters/sort) live in the URL, zod-validated in the route file via helpers in `src/lib/search-params.ts`. `defaultPreloadStaleTime: 0`.
- `@tanstack/react-router-ssr-query` wraps the app; no manual Provider.

## Routing & component conventions

- `src/routes/` files are thin page constructors: `createFileRoute`, `validateSearch`, `loader`, and a `RouteComponent` that passes everything as **props** to a page in `src/components/`.
- Component folder path mirrors the route path minus `.tsx` (drop `_authenticated`/`_public` groups); page exports named `Page`. Large pages get a `components/` subfolder.
- **Never `useSearch({ from })`/`useNavigate({ from })` from pages under `_authenticated` routes** — it fails typecheck (TS2820/TS2322); pass search data/navigators via props instead.
- Build UI from `src/components/ui/` (shadcn) and `src/components/shared/`; reuse over recreate. No comments unless asked.
- `routeTree.gen.ts` is generated — do not edit.

## Database / schema

- Schema lives in `src/db/schema.ts`; read it before adding columns. Equipment images are a single R2-key column (`equipment.imagePath`, e.g. `equipment-images/{id}.jpg`).
- Local dev DB is `.wrangler/` state (gitignored); `db:migrate-local` on the `meriksirat_d1` binding.
- To test admin flows locally, promote yourself:
  `npx wrangler d1 execute meriksirat_d1 --local --command "update user set role='admin' where email='you@example.com';"`

## Env

- Local: `.env` (see `.env.example`). Production builds read `wrangler.jsonc` bindings; secrets via wrangler secrets.
- Set `DEV=true` locally to auto-skip the Telegram onboarding step.
- Google master tokens (`GOOGLE_MASTER_ACCESS_TOKEN`/`GOOGLE_MASTER_REFRESH_TOKEN`) expire; refresh with `scripts/google-mint-token.mjs` (see also `scripts/cleanup-gcal.mjs`).

## Cron / scheduled work

`server.ts` handles the `*/5 * * * *` cron: auto-cancel unstarted bookings, mark overdue, send 4 idempotent Telegram reminders (each tracks a `*_sent_at` column). Test with `wrangler dev --test-scheduled`.

## Docs

`docs/` holds published and generated docs only: `faq.md` and `terms-of-service.md` are URL-pinned from `src/` and must never move. Domain vocabulary lives in `GLOSSARY.md`; decisions live in `docs/adr/`; agent-skill config lives in `docs/agents/`. One home per fact — link, never copy. Before restructuring `docs/`, load the `icm-architect` skill and run its Restructure mode (reference-integrity check + human approval gate).

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `sagyzdop/meriksirat`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
