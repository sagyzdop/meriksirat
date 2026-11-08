# Dashboard

`/admin/dashboard` is for admins and managers. A header (Alerts, Quick Actions, and for admins a test-email button) sits above five tabs: Bookings, Albums, Members, Flamekeepers, Storage.

## What do the Alerts show?

```mermaid
flowchart LR
    A["Alerts popover (badge = count)"] --> B["Overdue bookings: danger"]
    A --> C["Active bookings: warning"]
    A --> D["Bookings starting within 15 min: info"]
    A --> E["Members with 2+ violations: warning"]
    A --> F["Users without Telegram: info"]
    A --> G["Albums whose Drive folder is in the bin or missing: warning"]
    B & C & D --> L1["link to /admin/bookings"]
    E & F --> L2["link to /admin/members"]
    G --> L3["link to /admin/albums"]
```

Each alert appears only when its count is above zero; otherwise the popover reads "All clear". The album check uses cached folder state and never calls Drive.

## What does each tab show and where does it lead?

```mermaid
flowchart TD
    T["Dashboard tab"] --> B["Bookings: counts by status for a date range (default: month start to now)"]
    T --> AL["Albums: album, photo and byte counts for the range"]
    T --> M["Members: total, new this month, onboarding incomplete, Telegram unlinked, role and clearance counts"]
    T --> FK["Flamekeepers: count per state, pledged / used / free, pool-low flag"]
    T --> ST["Storage: buffer usage and pool usage"]
    B --> L1["Booking Oversight"]
    AL --> L2["Album Management"]
    M --> L3["Club Members"]
    FK --> L4["Flamekeepers and Flamekeeper settings"]
    ST --> L5["Storage settings"]
```

- Quick Actions link to Club Members, Add Equipment and Bookings, and offer Export Members; admins also get Broadcast ([settings/broadcast.md](../settings/broadcast.md)).
- The Flamekeepers tab shows the `drained` state as "Stopped", like everywhere else.
- Storage numbers and the thresholds behind them: [settings/storage.md](../settings/storage.md), [pool.md](../flamekeepers/pool.md).
