# Browse album lists

> **Question:** How do the three album lists (My Albums, Manage Albums, public Albums) load, who can see what, and how fresh are they?
>
> **Answer:** All three lists show albums that are not deleted, newest created first, 24 per page, grouped by the year and month the album was created, and load more as you scroll. My Albums shows albums you own or co-author, Manage Albums (admin or manager only) shows every album, and the public gallery at /albums shows every album to anyone, signed in or not. Search matches title or description. The public list is limited to 120 requests a minute per IP and is cached, so a new or changed album can take up to 10 minutes to show there.
>
> **Notes:**
> - Public list cache: a 30 second memory copy per Worker instance (25 entries) in front of the edge Cache API (no KV writes) under a key made from a hash of the query, with a 10 minute TTL, kept per data centre. Nothing clears it when albums change.
> - The lists are always refetched on a visit or window focus (staleTime 0). The public cache is the only delay.
> - Not signed in on My Albums, or not admin or manager on Manage Albums, returns an empty list instead of an error.
> - The ownership filter ("Owned by me" and "Shared with me") exists on My Albums and Manage Albums only. On Manage Albums "Shared with me" means every album owned by someone else.
> - The server accepts a page size of 1 to 100. The web pages always ask for the default of 24.
> - Grouping uses the creation date in UTC, not the event date.
> - Cover images come from Google's CDN, see download-photos.md for how images load.
> - Opening one album is in view-album.md.

```mermaid
sequenceDiagram
    autonumber
    participant U as Member, Admin or Guest
    participant B as Browser
    participant W as Worker
    participant K as KV
    participant D as D1
    U->>B: Open My Albums
    B->>W: getMyAlbumsFn(search, ownership, limit, cursor)
    alt No session
        W-->>B: Empty list
    else Signed in
        W->>D: Albums where owner = me or member, not deleted,<br/>newest first, limit + 1 rows
        W->>D: Load authors of those albums, 100 ids per query
        W-->>B: Albums and nextCursor
    end
    U->>B: Open Manage Albums (admin or manager)
    B->>W: getAllAlbumsFn(search, ownership, limit, cursor)
    alt Not admin and not manager
        W-->>B: Empty list
    else Admin or manager
        W->>D: All albums not deleted, newest first
        W-->>B: Albums and nextCursor
    end
    U->>B: Open the public gallery at Albums
    B->>W: getPublicAlbumsFn(search, limit, cursor)
    W->>W: rl_public_albums, 120 per 60 seconds per IP,<br/>skipped if the IP is unknown
    alt Rate limited
        W-->>B: Error Too many requests. Try again in 60 seconds.
    else Allowed
        W->>K: Read the public list cache (memory first, then edge cache)
        alt Cache hit
            K-->>W: Saved page
        else Cache miss
            W->>D: All albums not deleted, newest first
            W->>K: Save page, TTL 600 seconds
        end
        W-->>B: Albums and nextCursor
    end
    B->>U: Cards grouped by year and month
    U->>B: Scroll to the end of the list
    B->>W: Same function again with the nextCursor
```
