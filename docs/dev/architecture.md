# Architecture Map

High-level layout of the Meriksirat codebase.

## Stack

- **Frontend**: React 19, TanStack Router (file-based routes), TanStack Start (SSR + server functions), TanStack Query
- **UI**: shadcn/ui components (`src/components/ui/`), Tailwind CSS v4
- **Backend**: TanStack Start server functions (`createServerFn`) calling Drizzle ORM against Cloudflare D1
- **Auth**: Better Auth (`src/lib/auth/`)
- **Integrations**: Google Calendar (`src/lib/google/`), Telegram bot (`src/lib/telegram/`)

## Directory layout

```
src/
├── routes/                  # File-based router (TanStack). Thin page constructors.
│   ├── _public/             # Public routes (login, signup)
│   └── _authenticated/      # Authed area: equipment, bookings, albums, admin/*
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── shared/              # Cross-page components (faceted filter, dialogs, booking bits)
│   ├── layout/              # PageContainer, PageHeader, Section, sidebar shell
│   ├── root/                # SiteHeader, authenticated shell
│   ├── admin/               # Admin pages (mirror routes)
│   ├── albums/  bookings/  equipment/  faq/  onboarding/  profile/  auth/
│   └── <page>/              # Page components, one folder per route (see conventions.md)
├── lib/
│   ├── admin/               # Admin server functions + queries
│   ├── albums/              # Album pages/upload manager
│   ├── auth/                # Better Auth setup + onboarding
│   ├── booking/             # createServerFn + queryOptions + types
│   ├── equipment/           # createServerFn + queryOptions + types
│   ├── user/                # User admin queries
│   ├── google/  telegram/   # Calendar + Telegram integrations
│   ├── search-params.ts     # URL array-param zod helpers
│   └── query-client.ts      # SSR-aware QueryClient factory
└── router.tsx               # Router + SSR query integration
```

## Domain libraries

Each domain (`equipment`, `booking`, `user`) splits into:

- `functions.ts` / `functions/` — `createServerFn` calls (Zod-validated, re-auth from request headers, D1 queries)
- `queries.ts` — `queryOptions` factories with structured query keys
- `types.ts` — shared types

Data flow is documented in detail in `docs/dev/data-loading.md`.

## The refactor conventions

- Routes are constructors; components own the UI. See `docs/dev/conventions.md`.
- Component folders mirror route paths minus `.tsx`.
- Array search params use `src/lib/search-params.ts` helpers.
- Shared multi-page components live in `components/shared/`.

## Noteworthy behaviors

- **Overdue/status**: bookings have `booked`, `active`, `partially_returned`, `returned`, `cancelled`, `overdue`; `overdue` is derived at render time. Admin can cancel a booked booking; actual `startedAt`/`returnedAt` rows drive start/return flows.
- **Equipment deletion**: deleting equipment with active bookings deactivates it instead (preserves history).
- **Uploads**: album image uploads run through a client-side queue manager (`lib/albums/upload-manager.ts`) surfaced in the site header widget.
- **Telegram onboarding**: in dev the Telegram step auto-skips (`isDevelopment`).
