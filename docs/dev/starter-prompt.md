# Starter Prompt

Copy this into a fresh AI coding session to get up to speed quickly.

---

You are working on **Meriksirat**, a full-stack equipment booking & management platform (React 19 + TanStack Start/Router/Query + Drizzle on Cloudflare D1, Better Auth, shadcn/ui, Tailwind v4, Google Calendar + Telegram integrations).

## Before you edit

- Read `docs/dev/conventions.md` and `docs/dev/architecture.md`, plus `docs/dev/data-loading.md`.
- Run `npx tsc --noEmit` first — it must stay at 0 errors.
- Format touched files with `npx prettier --write <files>` (`.prettierrc`: no semi, single quotes, 80 cols).
- `npm run lint` is broken at baseline; ignore its output.

## Key rules

1. **Routes are constructors.** Route files own the zod `validateSearch` schema, `loader`/`loaderDeps` (via `context.queryClient.ensureQueryData`), and a thin `RouteComponent` that passes data to the page as props.
2. **Components mirror routes.** A route `routes/_authenticated/admin/bookings/$bookingId.edit.tsx` maps to `components/admin/bookings/$bookingId.edit/index.tsx`, which exports `Page`. Big pages use a `components/` subfolder.
3. **Do NOT use `useSearch({ from })` / `useNavigate({ from })` from pages on `_authenticated` routes** — it fails typechecking. Pass search data and callbacks via props from the route instead.
4. **Search params**: use `stringArrayParam(z.enum([...]))`, `numberArrayParam()`, `booleanArrayParam()` from `src/lib/search-params.ts` for array params in route schemas.
5. **Data**: list/detail data goes through `queryOptions` factories (`src/lib/{equipment,booking,user}/queries.ts`) + `useQuery`. Mutations call `createServerFn` functions and invalidate by query-key prefix. Route loaders `ensureQueryData`.
6. **No comments** in code. Self-documenting names and small components instead.
7. Shared cross-page components go in `src/components/shared/`; page-local shared pieces in the page's own `components/`.
8. **Build UI from shadcn/ui components** (`src/components/ui/`). No hand-rolled layout primitives or status pills; use Badge (color-coded) for labels/status in tables and cards, lucide icons for placeholders (never static SVGs in `public/`). See `docs/dev/conventions.md`. Apply this every time you create components.

## Project structure quick map

- `src/routes/` — thin route constructors
- `src/components/{admin,albums,bookings,equipment,...}` — pages (mirror routes)
- `src/components/ui/` — shadcn primitives; `src/components/shared/` — cross-page components
- `src/lib/{equipment,booking,user}/` — server functions (`functions.ts`), queries (`queries.ts`), types
- `src/lib/search-params.ts`, `src/lib/query-client.ts`, `src/router.tsx`
- `docs/dev/` — architecture, conventions, data-loading, albums, calendar-viewer, worker-import-convention, shadcn-reference, logs, availability-badges, starter-prompt
- `docs/user/` — booking, member-guide, admin-guide

## Conventions for this repo

- Commit as you go on `main`, one logical change per commit, concise message (e.g. `refactor: extract shared equipment form components`).
- Use `@/` path alias for imports.
- Keep `npx tsc --noEmit` at 0 errors and `npx prettier` clean before committing.
