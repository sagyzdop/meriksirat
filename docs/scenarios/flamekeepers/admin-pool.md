# See the pool and change the per-account cap

> **Question:** Where does an admin see the #savenuimg pool usage, and how does an admin change the cap and the Pool-low alert?
>
> **Answer:** The Storage tab of the admin dashboard (/admin/dashboard/storage) and the Storage tab of Settings (/admin/settings/storage) show the same usage summary (`src/components/shared/storage-usage.tsx`): a Buffer meter and a Flamekeepers meter, each with used of limit, a percent and an alert marker. The Flamekeepers meter shows used and pledged space, the percent used and how many flamekeepers are lending. New uploads no longer use the pool: they go to the buffer (../albums/upload-to-buffer.md). Admins and managers can see it. Only admins can change the per-account cap, the most of one Drive the app may use, and the Pool-low alert (% used), in the Flamekeepers section of Settings, Storage. One Save stores both, refreshes the dashboard queries and shows a toast "Settings updated successfully". The cap applies to later moves to flamekeepers.
>
> **Notes:**
> - Free space counts only active flamekeepers. For each one it
>   is the smaller of pledge left and cap left.
> - The meter turns to its alert style when the used share of the
>   pledged total reaches the Pool-low alert percent (default 90,
>   range 50 to 99), or when nothing is pledged. The Telegram
>   alert to admins is sent by the clock, see
>   ../cron/flamekeepers/pool-top-up.md. The alert marker on the
>   meter follows the percent typed in the form before saving.
> - The cap defaults to 20 GB. The browser checks 1 to 1024 GB.
> - Managers do not see the Flamekeepers section of the Storage
>   settings. Calling the function as a manager is refused with
>   "Insufficient permissions".
> - The cap does not move photos that are already stored.

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant Browser
    participant Worker
    participant D1
    A->>Browser: Open /admin/settings/storage
    Browser->>Worker: getPoolOverviewFn()
    Worker->>D1: check role is admin or manager
    alt Not allowed
        Worker-->>Browser: error "Insufficient permissions"
    else Allowed
        Worker->>D1: read active and full flamekeepers,<br/>the cap and poolLowAlertPercent
        Worker-->>Browser: pledged, used, free, cap, alertPercent, count
        Browser-->>A: Flamekeepers meter, cap and Pool-low alert fields
    end
    A->>Browser: Type a cap in GB and an alert percent, press Save
    alt Under 1 or not a number
        Browser-->>A: Message under the field, Save disabled
    else Looks valid
        Browser->>Worker: setFlamekeeperCapFn(capGb)
        alt Cap above 1024 GB
            Worker-->>Browser: validation error
            Browser-->>A: Error toast, fallback "Failed to save"
        else Not an admin
            Worker->>D1: check role is admin
            Worker-->>Browser: error "Insufficient permissions"
            Browser-->>A: Error toast with the message
        else Admin
            Worker->>D1: check role is admin
            Worker->>D1: settings.flamekeeperCapBytes = capGb in bytes
            Worker-->>Browser: success
            Browser->>Worker: updateSettingsFn(poolLowAlertPercent)
            Worker->>D1: settings.poolLowAlertPercent = percent
            Browser->>Browser: invalidate the admin-dashboard queries
            Browser-->>A: Toast "Settings updated successfully"
        end
    end
```
