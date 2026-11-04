# Choose the album cover

> **Question:** How does someone pick a photo as the album's cover?
>
> **Answer:** The owner, co-authors and admins or managers open a photo and click "Set as cover", which is greyed out for the photo that is already the cover. The Worker checks that the photo belongs to this album, as a row or a listed file, and saves it as the cover, and the page shows "Cover photo updated". If nobody picks one, the earliest uploaded photo is used and saved the first time the album page has a complete listing.
>
> **Notes:**
> - For a legacy album that is not indexed, the photo check is skipped, see legacy-albums.md.
> - The cover appears on album cards from Google's image servers at 800 px, and as the link preview picture at 1200 px.
> - Deleting the cover photo clears the cover, see delete-photo.md.

```mermaid
sequenceDiagram
    autonumber
    participant M as Owner, co-author or admin
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant K as KV
    M->>B: Open a photo, click Set as cover
    B->>W: setCoverPhotoFn(albumId, fileId)
    W->>D: Load album and the caller's role
    alt Album missing, deleted or caller has no role
        W-->>B: Error Album not found or Insufficient permissions
    else Allowed
        opt Album is indexed
            W->>D: Is there a photo with this file id in this album
            W->>K: If not, look for it in the album's listing
            W-->>B: Error Photo not found in this album, if neither
        end
        W->>D: Set coverFileId
        W->>K: Delete album:detail:albumId
        W-->>B: success
        B->>M: Toast "Cover photo updated", reload album data
    end
    opt Any error
        B->>M: Red toast with the message, or "Failed to set cover"
    end
```
