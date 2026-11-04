# Open an album page

> **Question:** What happens when someone opens an album link, signed in or not, and what do they see?
>
> **Answer:** Every album can be opened by anyone with the link, because all albums are public. The Worker works out the viewer's role (manager, owner, co-author or none) and returns the album with its photos. Guests are limited to 60 opens a minute per IP address, signed in users are not limited. The authors are cached for up to six hours and the photo list comes from a cached Drive listing, both shared by all viewers. Only people with a role get the edit link and the manage panel. A deleted album shows a "deleted" notice instead of photos, and an unknown id shows "Album not found".
>
> **Notes:**
> - Role per viewer is always checked fresh against the album row. The cover and expiry also come from the fresh row.
> - Core cache: 30 second memory copy per Worker instance in front of KV `album:detail:ALBUM_ID` with a 6 hour TTL. It is cleared by editing details, Refresh, deleting a photo, choosing a cover, joining or leaving as co-author, and deleting a gone album (see deleted-folder-warning.md). It no longer holds photos or folder health.
> - Photos and folder health (ok, trashed, missing) come from KV `album:list:FOLDER_ID`. A fresh entry means no Drive call. How long an entry stays fresh, and what happens when listing fails, is in [ADR-0017](../../adr/0017-drop-photo-table-read-from-drive.md).
> - Owners and admins also get a fewer-photos warning when a buffer Volume lists less than expected, built per viewer, see fewer-photos-warning.md.
> - A listing that fails never stops the page: the last listing is shown, or no photos if there is none yet.
> - If the album has no cover yet, the earliest uploaded photo becomes the cover. It is saved on the album only when the listing is complete.
> - The header always shows "Expires on DATE" for an unpinned album with an expiry (pinned albums show the Pinned badge instead). The page also shows a banner "Will be deleted on DATE" with "There is no backup. Download the photos you want to keep before then." once the expiry is within 30 days and the album is not pinned.
> - Photos load straight from Google's image servers: thumbnails at 600 px and full view at 1920 px. At most 6 images load at once, and a failed image is retried up to 5 tries, waiting 1, 2, 4 then 8 seconds.
> - Older albums are read the same way, see legacy-albums.md. Downloading is in download-photos.md.

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
                W->>K: Save core, TTL 6 hours
            end
            W->>D: Buffer and flamekeeper volumes of the album
            W->>K: Read album:list:folderId
            opt A section is due or its stamp changed
                W->>G: Master token: folder state
                W->>G: Each due section's owner token: list its folder
                W->>K: Save the listing, TTL 8 days
            end
            W-->>B: Album, photos, role, and edit token only if role exists
            B->>U: Title, authors, photo grid, expiry banner
            opt Viewer has a role
                B->>U: Manage panel: upload, share, edit, refresh
            end
        end
    end
```
