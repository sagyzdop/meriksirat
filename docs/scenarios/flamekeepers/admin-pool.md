# See the pool and change the per-account cap

> **Question:** What does the #savenuimg pool card on the admin dashboard show, and how does an admin change the cap?
>
> **Answer:** The Albums tab of the admin dashboard shows how much space active and full flamekeepers have pledged, how much is used, and how much is still free for new photos. Admins and managers can see it. Only admins can change the per-account cap, the most of one Drive the app may use. Saving stores the new cap, refreshes the card and shows a toast. The cap applies to new placements from then on.
>
> **Notes:**
> - Free space counts only active flamekeepers. For each one it
>   is the smaller of pledge left and cap left, after subtracting
>   space reserved for uploads in progress.
> - The Free number turns red when free space is under 10 percent
>   of the pledged total, or when nothing is pledged. The Telegram
>   alert to admins is sent by the clock, see
>   ../cron/flamekeepers/pool-top-up.md.
> - The cap defaults to 20 GB. The server accepts 1 to 1024 GB.
>   The browser only checks the lower limit, so a cap above 1024
>   is refused by the server and shows an error toast.
> - Managers do not see the cap field. Calling the function as a
>   manager is refused with "Insufficient permissions".
> - The cap does not move photos that are already stored.

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant Browser
    participant Worker
    participant D1
    A->>Browser: Open /admin/dashboard, Albums tab
    Browser->>Worker: getPoolOverviewFn()
    Worker->>D1: check role is admin or manager
    alt Not allowed
        Worker-->>Browser: error "Insufficient permissions"
    else Allowed
        Worker->>D1: read active and full flamekeepers,<br/>live reservations and the cap setting
        Worker-->>Browser: pledged, used, free, cap, count
        Browser-->>A: Card with Pledged, Used, Free and bar
    end
    A->>Browser: Type a cap in GB, press Save
    alt Under 1 or not a number
        Browser-->>A: Toast "Enter a cap of at least 1 GB"
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
            Browser->>Browser: invalidate the pool query
            Browser-->>A: Toast "Per-account cap updated"
        end
    end
```
