# Dashboard Overview And Alerts

> **Question:** What does an admin or manager see when they open the dashboard, and where do the numbers come from?
>
> **Answer:** The Overview tab shows booking counts by status, albums created per month and photo storage for a date range, which is the current month until the person picks another. A bell menu lists alerts such as overdue bookings, users with repeated violations and album folders in the Drive bin. If a loader fails the error is only logged and the page still opens with empty cards.
>
> **Notes:**
> - The range filters bookings by their start time and albums by creation time. Deleted albums are left out.
> - Stats stay fresh for 60 seconds in the browser. Alerts reload by themselves every 60 seconds.
> - An album whose photos are not yet counted in the database is counted by listing its Drive folder. It uses the master section of the album's KV listing when that is complete, so the Drive is called only for albums without one.
> - A Drive "not found" for one album is skipped silently. Any other Drive error is logged and that album adds nothing to the totals.
> - Alerts about album folders use only what KV already holds and never call Drive.
> - The Telegram alert counts every account without a linked chat, not only club members.
> - Picking a date range or pressing Reset range changes the URL and reloads the stats.

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1
    participant KV
    participant Drive

    Person->>Browser: open /admin/dashboard
    Browser->>Worker: getAdminDashboardStatsFn(startDate, endDate)
    Worker->>D1: count albums created in range, by month
    Worker->>D1: count bookings starting in range, by status
    Worker->>D1: read photo counts of albums in range
    opt some albums have no photo count yet
        loop 4 albums at a time
            Worker->>KV: read album:list:folderId
            opt not cached
                Worker->>Drive: list folder files with master token
            end
        end
    end
    Worker-->>Browser: albumsPerMonth, bookingStats, albumStorage
    Browser->>Worker: getAdminDashboardAlertsFn()
    Worker->>D1: count overdue, active, starting within 15 minutes
    Worker->>D1: count users with over 1 violation, no Telegram
    Worker->>KV: read cached folder state of every live album
    Worker-->>Browser: alerts list
    alt a loader call fails
        Note over Browser: error is logged only
        Browser-->>Person: page opens with empty cards
    else loads
        Browser-->>Person: cards, charts and bell badge
    end
    Person->>Browser: pick a date range or Reset range
    Browser->>Worker: getAdminDashboardStatsFn(new range)
    Worker-->>Browser: stats for the new range
    Note over Browser: alerts text, with N as the count<br/>N overdue bookings, danger<br/>N active bookings, warning<br/>N bookings start within 15 minutes, info<br/>N users with 2+ violations, warning<br/>N users without a linked Telegram account, info<br/>N album folders need attention, warning
```
