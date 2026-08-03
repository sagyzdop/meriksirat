# Data Loading Architecture

All data loading flows through **TanStack Query** with an SSR streaming integration on top of **TanStack Start**. The single source of truth for every list/detail page is a `QueryClient`; the router, server functions, and components all read and write to it.

## The QueryClient lifecycle

`src/lib/query-client.ts` owns client creation:

- **Server (SSR):** a fresh `QueryClient` is created per request, so caches never leak between users/requests.
- **Client:** a single shared instance is created once and reused for the whole session.

Defaults: `staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: false`, `retry: 1`.

## Router + SSR integration

`src/router.tsx` creates the router and wires up the integration:

```ts
const queryClient = getQueryClient()

const router = createRouter({
  routeTree,
  context: { queryClient }, // available to loaders via context.queryClient
  ...
})

setupRouterSsrQueryIntegration({ router, queryClient })
```

What the integration does:

1. **Wraps the app** in a `QueryClientProvider` (via the router's `Wrap`), so no manual provider is needed (removed from `__root.tsx`).
2. **Server:** dehydrates all queries resolved during SSR and **streams** any that resolve mid-render to the client (`StreamInitialData`).
3. **Client:** hydrates the initial state, then incrementally hydrates streamed queries.
4. **Redirects** thrown from queries/mutations are handled.

## The flow, end to end

1. **Query definitions** (`src/lib/{equipment,booking,user}/queries.ts`) declare `queryOptions` with a structured query key (`['equipment', 'list', filters]`, `['bookings', 'admin-list', filters]`, `['users', 'list', filters]`) and a `queryFn` that calls a server function (`createServerFn` from `@tanstack/react-start`).
2. **Server functions** (`src/lib/equipment/functions.ts`, `src/lib/booking/functions/*`, `src/lib/user/functions.ts`) validate their input with a Zod schema, re-auth the session from request headers, and run the actual D1 query. They return `null`/empty responses on failure so the UI can fall back.
3. **Route loaders** (`src/routes/_authenticated/{equipment,bookings}/index.tsx`, admin variants) preload the data that the page will render by calling `context.queryClient.ensureQueryData(...)` (or `Promise.all` of several queries, e.g. list + categories). This runs during SSR and during client-side navigation.
4. **Components** consume the same `queryOptions` with `useQuery(...)`. Because the loader already seeded the cache, the component renders immediately with cached data; `isFetching`/`isLoading` drive skeletons and spinners.
5. **Search params drive the query**: pagination/sorting/filtering live in the URL (zod-validated `search` schemas). Changing a filter navigates to a new URL, the loader preloads the new key, and the list refetches. `defaultPreloadStaleTime: 0` makes prefetches fresh on every navigation.

## Mutations and cache invalidation

Mutations call server functions directly (e.g. inside `useMutation`), then invalidate the affected query families:

```ts
await queryClient.invalidateQueries({ queryKey: ['equipment'] }) // or ['bookings'], ['users']
```

The prefix keys (`equipmentQueries.all`, `bookingsQueries.all`, `usersQueries.all`) are invalidated rather than exact keys, so every filtered/paginated variant refreshes. `router.invalidate()` is still used in a few non-Query places (auth/logout, onboarding, booking detail pages that load via route loaders).

## Query key conventions

| Domain     | Prefix      | Example keys                                   |
| ---------- | ----------- | ---------------------------------------------- |
| Equipment  | `equipment` | `['equipment','list',filters]`, `['equipment','admin-list',filters]`, `['categories']` |
| Bookings   | `bookings`  | `['bookings','list',filters]`, `['bookings','admin-list',filters]` |
| Users      | `users`     | `['users','list',filters]`                     |

Invalidate by prefix and all related variants refresh.

## Data tables / pagination

Data tables render `pagination.limit` rows per page (default **50**) and sync `page`, `limit`, `sortBy`, `sortOrder`, and filters to the URL search params. Changing any of them triggers the loader → `ensureQueryData` → refetch cycle above.
