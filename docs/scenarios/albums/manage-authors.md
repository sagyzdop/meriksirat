# Remove a co-author or leave an album

> **Question:** How does a co-author leave an album, and how does an owner remove someone?
>
> **Answer:** The owner and admins or managers can remove any co-author with the x on their name badge, and see the toast "Co-author removed". A co-author can only remove themselves with the Leave album button and confirmation, and sees "You left the album" before returning to My Albums. Anyone else gets "Insufficient permissions". The removed person loses upload and edit rights right away. The owner stays the same.
>
> **Notes:**
> - The page never offers a way to remove the owner or yourself with the x. The x does not appear on the owner's badge or on your own badge. The Worker itself does not refuse such a request, so a request for the owner's id would lower the owner's album count.
> - Removing lowers that user's album count by 1, never below 0, even if they were not actually a co-author.
> - Photos a co-author uploaded stay in the album.
> - The Leave album button appears only for co-authors. An admin or manager who joined with the edit link keeps the manager role and has no Leave button.

```mermaid
sequenceDiagram
    autonumber
    participant M as Owner, admin or co-author
    participant B as Browser
    participant W as Worker
    participant K as KV
    participant D as D1
    participant T as Telegram
    alt Owner or admin removes a co-author
        M->>B: Click x on the co-author's badge
        B->>W: removeMemberFn(albumId, userId)
    else Co-author leaves
        M->>B: Click Leave album, confirm
        B->>W: removeMemberFn(albumId, own userId)
    end
    W->>D: Load album and the caller's role
    alt Album missing or deleted
        W-->>B: Error Album not found
    else Not owner, admin or manager,<br/>and not a co-author removing self
        W-->>B: Error Insufficient permissions
    else Allowed
        W->>D: Read the removed user's name for the log
        W->>D: Delete the album_member row
        W->>D: Lower that user's albumCount by 1, minimum 0
        W->>K: Delete album:detail:albumId
        W->>T: Log "member_removed" naming the removed user
        W-->>B: success
        alt Removed by owner or admin
            B->>M: Toast "Co-author removed", reload album data
        else Left by co-author
            B->>M: Toast "You left the album", go to My Albums
        end
    end
    opt Any error
        B->>M: Red toast with the message, or<br/>"Failed to remove member" or "Failed to leave album"
    end
```
