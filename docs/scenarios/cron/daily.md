# Daily

Schedule `0 3 * * *` (03:00 UTC). One step, `graduateFlamekeepers`, in `src/lib/pool/graduation-server.ts`. Budget rules: [overview.md](overview.md).

When does flamekeeping end automatically, and who gets asked to confirm?

```mermaid
flowchart TD
    A[All flamekeepers not Stopped] --> B{"Email not @nu.edu.kz,<br/>or today is 60 days before graduation date?"}
    B -- yes --> C["End flamekeeping, up to 3 per run (3 requests each)"]
    C --> D[Email the flamekeeper why]
    B -- no --> E{"Graduation date set and 365 days since<br/>last confirmation or sign-up, no prompt sent for that due date?"}
    E -- yes --> F["Email asking to confirm the date, up to 2 per run (1 request each)"]
    F --> G[Set graduationPromptSentAt]
```

- Ending follows `endFlamekeeping`: Draining while volumes are held, otherwise Stopped (see [hourly.md](hourly.md)).
- Reason is `domain` (left the NU domain) or `graduation`. Lost flamekeepers are skipped for the confirmation prompt.
- A flamekeeper stopped in this run gets no prompt.
- Prompt timing: the confirmation clock restarts when the flamekeeper confirms (`graduationConfirmedAt`).
