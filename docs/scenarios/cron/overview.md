# The 5-minute cron run

> **Question:** What happens every 5 minutes when the clock trigger fires?
>
> **Answer:** The Worker runs 13 background steps one after another, always in the same order. They share one budget of 40 outside requests (calendar, Telegram, Drive and similar calls). If a step fails, the error is logged and the next step still runs. When the budget runs out, a step that needs more requests skips or stops its work and picks it up on a later run. At the end the Worker logs how much of the budget was used.
>
> **Notes:**
> - The schedule is `*/5 * * * *` in `wrangler.jsonc`. The work runs inside `ctx.waitUntil`, so it can finish after the trigger itself has returned.
> - Steps run strictly in sequence, not in parallel. Each step file is loaded only when its turn comes.
> - Budget total is 40 (`RUN_SUBREQUEST_BUDGET`), under the Worker limit of 50 (`WORKER_SUBREQUEST_LIMIT`). Database queries are not counted, only outside requests.
> - Budget calls: `take(n)` is all or nothing and returns false when short. `takeUpTo(n)` grants what is left. `spend(n)` records a cost without checking. `require(n)` throws `BudgetExhaustedError`. `sub(cap)` hands a step a smaller slice of the same pool.
> - A thrown `BudgetExhaustedError` is handled like any other error: logged as `Error in <step>:` and the run moves on.
> - Later steps still run after the budget is empty. Each one checks its own costs, so most do nothing that needs an outside request.
> - Steps 1 to 3 are in `bookings/cancel-unstarted.md`, `bookings/mark-overdue.md` and `bookings/reminders.md`. Steps 4 to 8 are in the `flamekeepers/` folder, starting with `flamekeepers/steps-and-limits.md`. Steps 9 to 11 and 13 are in the `albums-and-housekeeping/` folder, starting with `albums-and-housekeeping/run-order.md`. Step 12 is in `flamekeepers/buffer-usage.md`.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cron
    participant Worker as Worker
    Cron->>Worker: scheduled every 5 minutes<br/>runScheduled via ctx.waitUntil
    Worker->>Worker: createBudget(40)<br/>one budget shared by all steps
    Worker->>Worker: 1 cancelUnstartedBookings<br/>src/lib/booking/cron.ts
    Worker->>Worker: 2 updateOverdueBookings<br/>src/lib/booking/cron.ts
    Worker->>Worker: 3 sendBookingReminders<br/>src/lib/booking/cron.ts
    Worker->>Worker: 4 checkFlamekeeperHealth<br/>pool/health-server.ts<br/>runFlamekeeperHealth
    Worker->>Worker: 5 maintainPool<br/>pool/server.ts runPoolMaintenance
    Worker->>Worker: 6 drainFlamekeepers<br/>pool/drain-cron.ts<br/>runDrainMaintenance
    Worker->>Worker: 7 finishBans<br/>pool/ban-server.ts runBanMaintenance
    Worker->>Worker: 8 graduateFlamekeepers<br/>pool/graduation-server.ts<br/>runGraduationMaintenance
    Worker->>Worker: 9 expireAlbums<br/>albums/expiry.ts runAlbumExpiry
    Worker->>Worker: 10 notifyPublicAlbums<br/>albums/public-notice-server.ts<br/>runPublicAlbumNotices
    Worker->>Worker: 11 backfillAlbumPhotos<br/>albums/photo-index.ts<br/>runPhotoBackfill
    Worker->>Worker: 12 checkBufferUsage<br/>buffer/usage-server.ts<br/>runBufferUsageCheck
    Worker->>Worker: 13 configureTelegramBot<br/>telegram/configure.ts
    alt a step throws
        Worker->>Worker: console.error Error in step name<br/>then continue with the next step
    end
    alt budget short for a request
        Worker->>Worker: take(n) returns false<br/>step skips or stops, tries next run
    end
    Worker->>Worker: log cron outside requests spent/40
```
