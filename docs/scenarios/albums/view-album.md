# Open an album page

> **Question:** What happens when someone opens an album link, signed in or not, and what do they see?
>
> **Answer:** Every album can be opened by anyone with the link, because all albums are public. The Worker works out the viewer's role (manager, owner, co-author or none) and returns the album with its photos. Guests are limited to 60 opens a minute per IP address, signed in users are not limited. The expensive part (photo list, authors, cover) is cached for up to an hour and shared by all viewers. Only people with a role get the edit link and the manage panel. A deleted album shows a "deleted" notice instead of photos, and an unknown id shows "Album not found".
>
> **Notes:**
> - Role per viewer is always checked fresh against the album row. Only the shared core is cached.
> - Core cache: 30 second memory copy per Worker instance in front of KV `album:detail:ALBUM_ID` with a 1 hour TTL. It is cleared by editing details, Refresh, deleting a photo, choosing a cover, joining or leaving as co-author, and deleting a gone album (see deleted-folder-warning.md). It is not cleared when an upload is confirmed, so new photos can take longer to appear unless Refresh is used, see refresh-album.md.
> - Folder health (ok, trashed, missing) is cached separately in KV `album:list:FOLDER_ID` for 5 minutes.
> - If the album has no cover yet, the earliest uploaded photo becomes the cover and is saved on the album.
> - The page shows a banner "Will be deleted on DATE" with "There is no backup. Download the photos you want to keep before then." once the expiry is within 30 days and the album is not pinned.
> - Photos load straight from Google's image servers: thumbnails at 600 px and full view at 1920 px. At most 6 images load at once, and a failed image is retried up to 5 tries, waiting 1, 2, 4 then 8 seconds.
> - The figures above are for albums whose photos are in the photo table. How photos are listed for old albums is in legacy-albums.md. Downloading is in download-photos.md.

```mermaid
sequenceDiagram
    autonumber
    participant U as Member or Guest
    participant B as Browser
    participant W as Worker
    participant K as KV
    participant D as D1
    participant G as Drive
    U->>B: Open /albums/albumId
    B->>W: getAlbumFn(albumId)
    opt Viewer is not signed in
        W->>W: rl_album_detail, 60 per 60 seconds per IP
        W-->>B: Error Too many requests. Try again in 60 seconds.
    end
    W->>D: Load the album row
    alt No such album
        W-->>B: null
        B->>U: "Album not found"
    else Album found
        W->>D: Viewer role: admin or manager, owner,<br/>album_member row, or none
        alt Album was deleted
            W-->>B: Notice with reason, title and deletion date
            B->>U: Deleted notice and a Browse albums button
        else Album is live
            W->>K: Read album:detail:albumId
            alt Cache miss
                W->>D: Owner and co-authors names
                W->>K: Read album:list:folderId (folder health)
                W->>G: Master token: folder state, only if not cached
                W->>D: Live photos of the album
                W->>K: Save core, TTL 3600 seconds
            end
            W-->>B: Album, photos, role, and edit token only if role exists
            B->>U: Title, authors, photo grid, expiry banner
            opt Viewer has a role
                B->>U: Manage panel: upload, share, edit, refresh
            end
        end
    end
```
