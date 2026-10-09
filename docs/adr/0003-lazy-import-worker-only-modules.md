# Import Worker-only modules lazily inside server-function handlers

A `createServerFn` is compiled twice — into the deployed Worker and as a browser
stub — so any browser-reachable module that statically imports a Worker-only
module (`cloudflare:workers`, `@/db`, `@/db/schema`, `drizzle-orm`,
`@/lib/auth/auth`) makes the client build fail to resolve it. We keep only
client-safe top-level imports and move `await import(...)` into each `.handler()`
body. Tree-shaking currently hides some leaks, but relying on it breaks the moment
an import is referenced at module scope, so this rule is treated as absolute.
