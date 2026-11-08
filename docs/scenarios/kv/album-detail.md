# KV: album-detail

Key `album:detail:{albumId}`.

How is the viewer-independent part of an album page cached?

```mermaid
flowchart TD
    A[Album detail request] --> B{"Memo (30 s) or KV hit?"}
    B -- yes --> C[Use cached core]
    B -- no --> D[Build core from D1]
    D --> E[put album:detail:id, TTL 6 h]
    E --> C
    X[Refresh, move, offload, remove, favorite remap] --> Y[delete key]
```

- Value: JSON album core (the parts that do not depend on who is viewing). TTL 6 hours; it only bounds how long an unnoticed change, such as a renamed author, can linger.
- Writer and reader: `getCachedDetailCore` and `setCachedDetailCore` used in `src/lib/albums/functions.ts` (detail loader). Invalidated by `invalidateCachedDetailCore` in `remove.ts`, `storage-server.ts`, `favorites/remap-server.ts`.
- A 25-entry, 30-second memo per isolate absorbs repeat traffic in front of KV.
- Why: the page is hit by shared links; the core is the same for everyone, and the memo plus explicit invalidation keeps KV writes low.
