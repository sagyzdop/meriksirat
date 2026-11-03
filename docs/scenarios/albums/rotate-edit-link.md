# Share and rotate the edit link

> **Question:** How do people copy an album's links, and what does rotating the edit link do?
>
> **Answer:** The Share dialog shows the view link, which anyone can open, and the edit link, which adds a signed in user as a co-author. Copying the view link puts a ready-made Telegram message (title, description, authors, link) on the clipboard. The owner and admins or managers can rotate the edit link: a new 24 character token replaces the old one, every earlier edit link stops working, and the new link is copied with the toast "Edit link rotated — new link copied". Existing co-authors keep their access.
>
> **Notes:**
> - Co-authors see the Share dialog and can copy both links but do not see the rotate button. Copying the edit link shows the toast "Link copied".
> - If the browser blocks the clipboard, the toast is "Edit link rotated" and the copy buttons show "Could not copy link" on failure.
> - Visitors without a role never receive the edit token from the server.

```mermaid
sequenceDiagram
    autonumber
    participant M as Owner or admin
    participant B as Browser
    participant W as Worker
    participant K as KV
    participant D as D1
    participant T as Telegram
    M->>B: Click Share on the manage panel
    B->>M: Dialog with view link and edit link
    M->>B: Click copy next to the view link
    B->>M: Toast "Copied to clipboard"
    M->>B: Click the rotate button and confirm Rotate link
    B->>W: rotateEditTokenFn(albumId)
    W->>D: Load album and the caller's role
    alt Album missing or deleted
        W-->>B: Error Album not found
    else Caller is a co-author or has no role
        W-->>B: Error Insufficient permissions
    else Owner or admin or manager
        W->>D: Save a new 24 character editShareToken
        W->>T: Log "token_rotated" to the club channel
        W-->>B: success and the new token
        B->>M: Toast "Edit link rotated — new link copied"
        B->>B: Reload album data
    end
    opt Any error
        B->>M: Red toast with the message, or "Failed to rotate edit link"
    end
```
