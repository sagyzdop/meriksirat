# KV: album-offload

Key `album:offload:{albumId}`.

How does an admin-started move to flamekeepers survive between its browser steps?

```mermaid
sequenceDiagram
    participant A as Admin browser
    participant S as Server (storage-server.ts)
    participant K as KV album:offload:albumId
    A->>S: startOffload
    S->>K: put plan of volumes and files, TTL 6 h
    S-->>A: sessions to upload
    A->>S: mintOffloadUploads (batches)
    S->>K: get plan
    A->>S: completeOffload with moved files
    S->>K: get plan, check it matches
    S->>K: delete plan
```

- Value: JSON `OffloadPending`: per destination volume `destUserId`, `volumeFolderId`, `permissionId`, `bytes`, and the files. TTL 21600 s.
- A second `startOffload` for the same album reuses the plan if the source files and free space still fit.
- A missing key returns "This move expired, start it again". A mismatch on completion is refused.
- Why: the photos are copied through the admin's browser across several calls, and the server must not trust the browser to say where files go.
