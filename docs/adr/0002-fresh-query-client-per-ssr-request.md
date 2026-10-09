# Create a fresh QueryClient per SSR request

All data loading flows through TanStack Query. On the server a new `QueryClient`
is created per request, while the browser reuses one shared instance for the
session. A single shared server client would leak one user's cached data into
another user's response, so per-request isolation is non-negotiable. The cost is
recomputing queries on every request, which route loaders (`ensureQueryData`) and
streaming hydration are there to absorb.
