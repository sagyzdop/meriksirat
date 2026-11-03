# Dashboard Albums Tab

> **Question:** What does the dashboard Albums tab show, and who sees which part?
>
> **Answer:** The tab lists the club's most active album makers for the chosen date range, ranked by the albums they own plus the albums they co-authored, with search, sorting and paging. Admins also get a Free up space list of albums that could be expired, with unpinned albums that nobody favorited first. Managers see the ranking and the storage pool card but not the Free up space list. Nothing here changes data. Expiring an album is a separate action.
>
> **Notes:**
> - The tab loads its data only when it is opened. The default is 10 rows, sorted by album count, highest first.
> - Only people with at least one album in the range appear in the ranking. The ranking counts deleted albums too, and the same date range as the Overview tab applies.
> - The Free up space order is: albums with no favorites before favorited ones, then soonest expiry (never-expiring last), then biggest size. Pinned and deleted albums are left out.
> - The pool card on this tab is documented in [../flamekeepers/admin-pool.md](../flamekeepers/admin-pool.md).
> - Expiring an album from the list is in [expire-album-early.md](expire-album-early.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1

    Person->>Browser: open the Albums tab
    Browser->>Worker: getAdminMostActiveUsersFn(range, search, page, sort)
    Worker->>D1: count albums owned or co-authored per user
    Note over Worker,D1: range filters album creation date<br/>users with no albums are left out
    Worker-->>Browser: users with albumCount and paging info
    Browser->>Worker: getPoolOverviewFn()
    Note over Browser,Worker: pool card, see flamekeepers/admin-pool.md
    opt person is an admin
        Browser->>Worker: getDeletionSuggestionsFn()
        Worker->>D1: read albums not deleted and not pinned
        Worker-->>Browser: suggestions in the order described below
    end
    alt role is manager
        Browser-->>Person: ranking and pool card only
    else role is admin
        Browser-->>Person: pool card, Free up space list, ranking
    end
    Person->>Browser: type in search box or click a column
    Browser->>Worker: getAdminMostActiveUsersFn(new filters)
    Worker-->>Browser: new page of users
    Note over Browser: Free up space shows "No albums to suggest."<br/>when the list is empty
```
