# Delete a photo

> **Question:** What happens when a member deletes one photo, and whose Google token removes the file?
>
> **Answer:** The owner, co-authors and admins or managers can delete a photo from the photo viewer after confirming "Delete photo?". The Worker finds the photo in this album's table, or failing that in the album's listing. If the buffer holds the file, it is deleted with the buffer's token and the volume's expected count and bytes go down. If a flamekeeper holds it, it is deleted with that flamekeeper's own token. If it is a master-owned or older file, it is deleted with the master token. Then the photo row (if any) goes, the album's photo count and size go down, its favorites of this file are removed and the favorite count drops with them, a cover that pointed at this photo is cleared, and the page shows the toast "Photo deleted".
>
> **Notes:**
> - Ownership checks, in order: the caller needs a role on this album, and the file id must belong to a photo of this same album, either a row or a listed file, so a photo id from another album is refused with "Photo not found in this album".
> - A listed file with no row is an upload whose confirm never landed. It is deleted with the token of the volume that lists it, and no counts change.
> - For a legacy album that is not indexed, a file id with no row and no listing is not refused. It is deleted from Drive with the master token as given. See legacy-albums.md.
> - A deleting caller's own token is never used. Admins deleting someone else's photo still delete it through that flamekeeper's token.
> - If the flamekeeper's access was lost or the flamekeeper is gone, the row is removed without the Drive file. If Drive fails for another reason, the error is shown and nothing is removed from the table.
> - The photo viewer and the dialog text say the photo is removed "from the album and your Drive storage".
> - Favorites of this photo are removed whether or not the photo has a row, and the album's favorite count goes down by that many.

```mermaid
sequenceDiagram
    autonumber
    participant M as Owner, co-author or admin
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant K as KV
    participant F as Buffer or flamekeeper Drive
    participant G as Master Drive
    participant T as Telegram
    M->>B: Open the photo, click Delete, confirm Delete
    B->>W: deletePhotoFn(albumId, fileId)
    W->>D: Load album and the caller's role
    alt Album missing, deleted or caller has no role
        W-->>B: Error Album not found or Insufficient permissions
    else Allowed
        W->>D: Find photo with this fileId in this album
        opt No row
            W->>K: Find the file in the album's listing
        end
        alt Not found and album is indexed
            W-->>B: Error Photo not found in this album
        else Held by the buffer or a flamekeeper
            W->>F: The holder's token (buffer or flamekeeper): delete the file
            alt Drive fails
                W-->>B: Error from Drive, nothing else changes
            else Flamekeeper access lost or flamekeeper gone
                W->>D: Go on without the Drive file
            end
        else Master-owned or legacy file
            W->>G: Master token: delete the file
        end
        W->>D: Remove favorites of this file, favorite count down
        opt Photo row exists
            W->>D: Photo count and bytes down,<br/>delete the photo row
        end
        W->>K: Delete album:list:folderId
        opt Photo was the cover
            W->>D: Clear coverFileId
        end
        W->>K: Delete album:detail:albumId
        W->>T: Log "photo_deleted" to the club channel
        W-->>B: success
        B->>M: Toast "Photo deleted", reload album data
    end
    opt Any error
        B->>M: Red toast with the message, or "Failed to delete photo"
    end
```
