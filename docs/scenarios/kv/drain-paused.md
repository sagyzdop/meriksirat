# KV: drain-paused

Key `drain-paused:{userId}` where `userId` is the draining flamekeeper.

How does the hourly drain avoid spamming admins when it is stuck?

```mermaid
flowchart TD
    A[Drain cannot move a flamekeeper's photos: buffer full or rescue failed] --> B{KV drain-paused:userId exists?}
    B -- yes --> C[Stay quiet]
    B -- no --> D[Telegram every admin]
    D -- sent --> E["put drain-paused:userId = 1, TTL 24 h"]
```

- Value: the string `1`. TTL: 86400 s.
- Writer and reader: `alertOncePerDay` in `src/lib/pool/drain-cron.ts`, called by `drainFlamekeepers` ([hourly.md](../cron/hourly.md)).
- Failures of KV reads and writes are logged and ignored, so an outage may repeat an alert.
- Why: the step runs every hour, so without the marker a blocked drain would alert 24 times a day. Nothing is deleted while paused.
