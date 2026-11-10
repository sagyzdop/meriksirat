# Album caches and flow state live in D1, not KV

The KV free plan allows 1,000 writes a day across the account. Album listing and
detail caches, offload plans, rescue markers and Telegram bot sessions all wrote
to KV, and on a busy day (a batch of new albums being listed for the first time)
the quota ran out within an hour of resetting. Cache writes failed quietly, but
moves to flamekeepers, equipment returns in Telegram and the Drive connect step
failed outright.

These now live in one D1 table, `app_state` (`key`, `part`, `value`,
`expires_at`), through `src/lib/app-state.ts`. D1 allows 100,000 row writes a
day on the free plan and is read-after-write consistent, which the offload plan
and the listing used for file authorization need. Keys and lifetimes are
unchanged. A value over the 2 MB row limit is split across `part` rows, and
every write deletes expired rows. OAuth connect state uses the `verification`
table (`src/lib/oauth-state.ts`).

This replaces the KV storage described in
[ADR-0017](0017-drop-photo-table-read-from-drive.md); the listing design there
is otherwise unchanged. KV keeps only rarely written markers: `buffer:usage`,
`buffer:alert`, the drain-paused alert, the public album list version and
`telegram-bot:configured-version`.
