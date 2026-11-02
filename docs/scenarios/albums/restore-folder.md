# Restore a folder from the Drive bin

> **Question:** What happens when an album's Drive folder is in the bin and someone clicks "Restore folder"?
>
> **Answer:** When the folder is in the Google Drive bin, the album shows "Album folder is in the Google Drive bin" and uploads are paused. The owner, co-authors and admins or managers click "Restore folder". The Worker takes the folder out of the bin with the master token, clears the "indexing skipped" mark if there was one, clears the cached copies, and the page shows "Album folder restored". Uploads work again. Nothing is deleted.
>
> **Notes:**
> - No confirmation dialog and no rate limit.
> - If Google cannot restore it (for example the folder was permanently deleted meanwhile), the error text is shown or "Failed to restore folder", and the page keeps showing the current state. For a permanently deleted folder use recreate-folder.md.
> - The bin state is noticed the next time the album core is rebuilt, which can take up to an hour unless Refresh is used, see refresh-album.md. The folder health itself is cached for 5 minutes.
> - The indexing mark that gets cleared belongs to legacy albums, see legacy-albums.md.

```mermaid
sequenceDiagram
    autonumber
    participant M as Owner, co-author or admin
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant K as KV
    participant G as Master Drive
    M->>B: Click Restore folder
    B->>W: restoreAlbumFolderFn(albumId)
    W->>D: Load album and the caller's role
    alt Album missing, deleted or caller has no role
        W-->>B: Error Album not found or Insufficient permissions
    else Allowed
        W->>G: Master token: take the folder out of the bin
        alt Google refuses
            W-->>B: Error from Google
        else Restored
            opt Indexing had been skipped for this album
                W->>D: Clear photosIndexSkipped
            end
            W->>K: Delete album:list:folderId
            W->>K: Delete album:detail:albumId
            W-->>B: success
            B->>M: Toast "Album folder restored", reload album data
        end
    end
    opt Any error
        B->>M: Red toast with the message, or "Failed to restore folder"
    end
```
