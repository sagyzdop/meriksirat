# Component & Routing Conventions

These are the conventions established during the architecture refactor. New code should follow them.

## Route = page constructor

Routes in `src/routes/` are thin. A route file owns:

1. `createFileRoute(...)` with the route id
2. `validateSearch` — a zod schema defined **in the route file** (use the helpers in `src/lib/search-params.ts` for array params)
3. `loader` / `loaderDeps` — preloads data via `context.queryClient.ensureQueryData(...)` so SSR and client navigation are instant
4. A `RouteComponent` that calls `Route.useSearch()` / `Route.useLoaderData()` / `Route.useRouteContext()` and passes everything the page needs as **props**

The page itself lives in `src/components/` and never reads router state directly.

```tsx
export const Route = createFileRoute('/_authenticated/admin/bookings/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    await context.queryClient.ensureQueryData(
      bookingsQueries.adminList(deps.search)
    )
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { data, isFetching } = useQuery(bookingsQueries.adminList(search))
  return (
    <Page
      bookings={response.data}
      pagination={response.pagination}
      filters={search}
      isLoading={isFetching}
    />
  )
}
```

## Components mirror routes

The component folder path equals the route file path minus `.tsx` (and dropping the `_authenticated`/`_public` group prefix):

| Route file                                                     | Component                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `routes/_authenticated/admin/bookings/$bookingId.edit.tsx`     | `components/admin/bookings/$bookingId.edit/index.tsx`     |
| `routes/_authenticated/bookings/bookings_/$bookingId.edit.tsx` | `components/bookings/bookings_/$bookingId.edit/index.tsx` |
| `routes/_authenticated/equipment/$/index.tsx`                  | `components/equipment/$/index.tsx`                        |
| `routes/_authenticated/admin/dashboard.tsx`                    | `components/admin/dashboard/index.tsx`                    |

The page's `index.tsx` exports a named `Page` (or a named function like `NewBookingPage`). The route imports it:

```tsx
import { Page } from '@/components/admin/bookings/$bookingId.edit'
```

Large pages get a `components/` subfolder with the extracted pieces:

```
src/components/admin/equipment/new/
├── index.tsx
└── components/
    ├── equipment-image-field.tsx
    └── equipment-form-fields.tsx
```

## Never `useSearch({ from })` from pages on `_authenticated` routes

`useSearch({ from })` / `useNavigate({ from })` typecheck for public routes (e.g. `/albums/`), but **fail to typecheck from external components on `_authenticated` routes** (TS2820/TS2322). Pages under the auth group must receive search data and navigators via props from the route's `RouteComponent`.

## Search params

- Keep array params in URL form (`?status=booked,cancelled`).
- Use `src/lib/search-params.ts` helpers instead of hand-written preprocess blocks:

```ts
const searchSchema = z.object({
  status: stringArrayParam(z.enum(['booked', 'active', 'cancelled'])),
  categoryIds: numberArrayParam(),
  isActive: booleanArrayParam(),
  page: z.coerce.number().default(1),
  sortBy: z
    .enum(['startTime', 'endTime', 'status', 'createdAt'])
    .default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
```

## Shared components

`src/components/shared/` holds components used by more than one page:

- `data-table-faceted-filter.tsx` — faceted multi-select filter column header
- `bulk-edit-clearance-dialog.tsx` — generic bulk-edit dialog (props: `open`, `onOpenChange`, `count`, `itemNoun`, `actionPhrase`, `successMessage`, `errorTitle`, `onSubmit`, `onSuccess`)
- `bulk-cancel-bookings-dialog.tsx` — generic bulk-cancel for bookings (user + admin)
- `booking-detail.tsx`, `booking-equipment-table.tsx`, `booking-schedule.tsx`, `booking-status-badge.tsx`, `time-slot-picker.tsx`, `event-calendar/`
- `data-table/` — generic TanStack Table wrapper (currently unused; page-specific tables live next to their pages)

Shared domain form pieces that fit under a specific page tree go in that page's `components/` folder (e.g. `admin/equipment/components/`).

## Data loading

See `docs/dev/data-loading.md`. All list/detail data flows through TanStack Query `queryOptions` factories (`src/lib/{equipment,booking,user}/queries.ts`); mutations call server functions and invalidate by query-key prefix.

## Code style

- No comments unless asked. Self-documenting names and small components instead.
- Format with `npx prettier --write` on touched files (`.prettierrc`: no semi, single quotes, tabWidth 2, printWidth 80).
- `npx tsc --noEmit` must stay clean (currently 0 errors).
- `npm run lint` is broken at baseline (TSX parser failures) — do not treat its output as actionable.

## shadcn/ui everywhere

- Build all UI from shadcn/ui components in `src/components/ui/` (Badge, Button, Card, Table, Dialog, AlertDialog, Form, Select, ...). Do not hand-roll layout primitives or status pills with raw `<div>` + custom Tailwind when a shadcn component fits.
- Use Badge for labels/status in tables and cards — color-code them with the existing palette (`bg-green-100 text-green-800`, `bg-red-100 text-red-700`, `bg-amber-100 text-amber-800`, `variant="destructive"` for admin/role, etc.). Keep value badges readable on `bg-card`.
- Placeholder images are lucide icons (`ImageIcon`), never static SVGs in `public/`.
- Before creating a new component, check `src/components/ui/` and `src/components/shared/` first; reuse over recreate.

## Delete dialogs differ per context

Equipment has two delete dialogs that intentionally differ: the index page uses a controlled dialog (`open`/`onOpenChange`) with a toast + invalidation; the edit page uses an inline AlertDialog that navigates away. Do not merge them without checking the surrounding page behavior.
