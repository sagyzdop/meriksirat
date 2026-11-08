# Public albums

Anyone can browse and open albums without signing in. `/` redirects to `/albums`. Signed-in people see the same pages inside the app shell, guests inside a plain header with a Login button.

## How does the public album list load?

```mermaid
sequenceDiagram
    autonumber
    participant V as Visitor
    participant B as Browser
    participant W as Worker
    participant K as Cache
    participant D as D1
    V->>B: Open /albums, type in search, scroll
    B->>W: getPublicAlbumsFn(search, cursor)
    W->>W: Rate limit rl_public_albums, 120 per 60 s per IP
    alt Over the limit
        W-->>B: "Too many requests"
    else Allowed
        W->>K: Read page (memory 30 s, then edge cache)
        alt Miss
            W->>D: Albums not deleted, newest created first, 24 per page
            W->>K: Save page for 600 s
        end
        W-->>B: Albums and nextCursor
    end
    B-->>V: Cards grouped by creation year and month
```

- Search matches title or description. There is no ownership filter on this list.
- Nothing clears the cache when albums change, so a new album can take up to 10 minutes to appear.
- Deleted albums (tombstones) are not listed.

## What does an album page show?

```mermaid
sequenceDiagram
    autonumber
    participant V as Visitor
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant G as Drive
    V->>B: Open /albums/albumId
    B->>W: getAlbumFn(albumId)
    opt Not signed in
        W->>W: Rate limit rl_album_detail, 60 per 60 s per IP
    end
    W->>D: Load album row
    alt No such album
        B-->>V: "Album not found"
    else Deleted
        B-->>V: Tombstone with the reason and deletion date, Browse albums button
    else Live
        W->>W: Core (authors) from cache, photo listing from cache
        opt Listing stale
            W->>G: List the volumes' folders
        end
        W-->>B: Album, photos, viewer's access level
        B-->>V: Title, authors, photo count, photo grid
    end
```

- Only an owner, co-author or album manager gets the edit token and manage panel, see [photos](../member/albums/photos.md).
- When the event is over two years old, a banner says the album may be deleted if storage runs low. Expiry and pinning are in the [GLOSSARY](../../../GLOSSARY.md).
- A failed Drive listing never breaks the page. It shows the last listing, or no photos.
- Photos load from Google's image servers (600 px thumbnails, 1920 px viewer).

## How does someone download photos?

```mermaid
flowchart TD
    A["Visitor on album page"] --> B{"What to download?"}
    B -->|"One photo"| C["Open photo, click Download"]
    C --> D["Browser opens the Drive download link for the file id, no token"]
    D --> E["Google serves the original as an attachment"]
    B -->|"Whole album"| F["Click Download in the page header (shown when the album has photos)"]
    F --> G["Drive folder opens in a new tab"]
    G --> H["Visitor uses Drive's own Download button, which zips the folder"]
```

The Worker is not involved. Album folders are always public ([ADR-0005](../../adr/0005-album-drive-folders-are-always-public.md)). Google offers no anonymous zip, so the folder link is the only whole-album download.
