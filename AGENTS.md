# AGENTS.md

Full-stack equipment booking platform: React 19 / TanStack Start (file-router) + Cloudflare Workers, D1 + Drizzle ORM, R2, KV. SSR runs in the Worker via `server.ts`.

## Commands

- `npm run dev` — apply local migrations, build, then `wrangler dev` on :3000 (this is the real dev loop; `dev:vite` is only the UI shell).
- `npm run test` — `vitest run`, node environment, plain unit tests only (see `src/tests/*.test.ts`). No DB/integration tests.
- `npm run lint` — **broken at baseline** (exits 1 on prettier/prettier formatting errors across many files). Do not treat output as actionable; `lint:fix` may rewrite files.
- `npx tsc --noEmit` — must stay clean (0 errors at baseline).
- Format touched files with `npx prettier --write` (no semi, single quotes, width 80).
- `npm run db:generate` — writes a new migration into `migrations/` (the script hardcodes `--name setup`, so every migration is named `setup` and numbered sequentially — don't rename them; numbers aren't contiguous, 0022 is unused, and `migrations/meta` was baselined at 0027); then `db:migrate-local` / `db:migrate-remote`.
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
- Buffer account tokens (`GOOGLE_BUFFER_REFRESH_TOKEN` drive.file, `GOOGLE_BUFFER_FULL_REFRESH_TOKEN` full `drive`, server-only, only `src/lib/buffer/full-token.ts` may name it): setup in README "Connecting the buffer account". Uploads go to the buffer and fail when it is unavailable; never fall back to flamekeepers.
- Google master tokens (`GOOGLE_MASTER_ACCESS_TOKEN`/`GOOGLE_MASTER_REFRESH_TOKEN`) expire; refresh with `scripts/google-mint-token.mjs` (see also `scripts/cleanup-gcal.mjs`).

## Cron / scheduled work

`server.ts` handles three Cron Triggers and picks the steps from `controller.cron`. The schedule strings, step groups and per-trigger budgets live in `src/lib/cron/schedule.ts` and must match `crons` in `wrangler.jsonc` character for character (a test checks this). Each trigger gets its own budget. Overview: `docs/scenarios/cron/overview.md`.

- `*/5 * * * *`: `cancelUnstartedBookings`, `updateOverdueBookings`, `sendBookingReminders` (4 idempotent Telegram reminders, each tracks a `*_sent_at` column).
- `0 * * * *`: `checkFlamekeeperHealth`, `maintainPool`, `drainFlamekeepers`, `finishBans`, `expireAlbums`, `checkBufferUsage`, then the Telegram bot configuration, which calls Telegram only when the deployed version (`CF_VERSION_METADATA.id`) differs from the KV marker `telegram-bot:configured-version`.
- `0 3 * * *`: `graduateFlamekeepers`.

Nobody holds photos on a flamekeeper until Stage 2 of #15: `maintainPool` only resets old `full` rows and sends the pool-low alert, and `drainFlamekeepers` only ends rows left in the old `draining` state. Stop, graduation, domain change and ban end flamekeeping at once (`src/lib/pool/stop-server.ts`). The old placement, drain and relay code is at `dev` commit `2565826`.

Test with `wrangler dev --test-scheduled`, then `curl "http://localhost:3000/cdn-cgi/handler/scheduled?cron=0+*+*+*+*"` (swap in each schedule, spaces as `+`).

## Docs

`docs/` holds published and generated docs only: `faq.md`, `terms-of-service.md` and `privacy-policy.md` are URL-pinned from `src/` and must never move. Domain vocabulary lives in `GLOSSARY.md`; decisions live in `docs/adr/`; agent-skill config lives in `docs/agents/`. One home per fact — link, never copy. Before restructuring `docs/`, load the `icm-architect` skill and run its Restructure mode (reference-integrity check + human approval gate).

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `sagyzdop/meriksirat`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
