# Run the whole app on Cloudflare Workers

Meriksirat deploys as a single Cloudflare Worker that serves both the API and SSR;
data lives in D1 (via Drizzle), images in R2, and ephemeral state in KV. We chose
Cloudflare for a zero-ops deploy (`wrangler deploy`) and one runtime target over
managing servers. The cost is lock-in and a constrained runtime — most visibly,
server code is compiled twice (Worker + client stub), which drives the
lazy-import rule described in `AGENTS.md` § Worker import convention (critical).
