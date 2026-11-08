# Change pledge

## How does a flamekeeper change their pledge?

```mermaid
sequenceDiagram
    autonumber
    actor F as Flamekeeper (Active or Full)
    participant W as Worker
    participant D1
    F->>W: Edit, pick 0.5 / 1 / 2 / 3 / 4 / 5 GB, Save (updateFlamekeeperFn)
    W->>W: pledge is an allowed option, graduation date valid
    W->>D1: batch: pledged_bytes, graduation_confirmed_at = now, user.graduation_date
    W->>W: graduation date within 60 days?
    alt yes
        W->>D1: end flamekeeping now (see stop.md)
    end
    W-->>F: toast "Pledge updated"
```

- The dialog resubmits the profile's graduation month; if none is set it asks for one first.
- A Stopped flamekeeper cannot edit ("Sign up again to resume flamekeeping").
- Changing the pledge counts as a graduation confirmation. A pledge is a cap on what the app uses, not reserved Google storage; the pool counts only Active and Full flamekeepers ([pool.md](../../admin/flamekeepers/pool.md)).
