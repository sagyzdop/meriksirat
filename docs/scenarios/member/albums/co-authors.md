# Co-authors and the edit link

Related: [create](create.md), [GLOSSARY: Co-author](../../../../GLOSSARY.md).

## How does someone become a co-author?

The edit link is the album address with `?edit=` and the album's 24 character edit token.

```mermaid
sequenceDiagram
    autonumber
    actor U as Visitor
    participant B as Browser
    participant W as Worker
    participant D as D1
    U->>B: Open /albums/albumId?edit=token
    alt Not signed in
        B-->>U: Toast "Please log in to join this album", go to login
        Note over B: The edit link is not kept, open it again after signing in
    else Signed in
        B->>W: claimEditAccessFn(albumId, token)
        alt Album missing or deleted
            W-->>B: Error Album not found
        else Token differs
            W-->>B: Error Invalid share link
        else Token matches
            opt Visitor is not the owner
                W->>D: Insert album_member (ignored if present), albumCount + 1
            end
            W-->>B: success
            B-->>U: Toast "You are now a co-author of this album", ?edit= removed, data reloaded
        end
    end
```

- The link works for any signed-in user. It checks neither club membership nor clearance. There is no approval step.
- Co-authors can upload, edit details, refresh, set the cover and delete photos. They cannot delete the album, rotate the link or remove others.
- Opening the link again adds no second membership, but albumCount goes up by 1 each time a non-owner uses it.

## How is the edit link shared and rotated?

```mermaid
sequenceDiagram
    autonumber
    actor M as Owner or album manager
    participant B as Browser
    participant W as Worker
    participant D as D1
    M->>B: Share
    B-->>M: Dialog with view link and edit link
    Note over B: Copying the view link puts a ready Telegram message (title, description, authors, link) on the clipboard
    M->>B: Rotate and confirm
    B->>W: rotateEditTokenFn(albumId)
    alt Co-author or no role
        W-->>B: Error Insufficient permissions
    else Owner or album manager
        W->>D: New 24 character editShareToken
        W-->>B: New token
        B-->>M: Toast "Edit link rotated — new link copied"
    end
```

Co-authors see the Share dialog and can copy both links but have no rotate button. Rotating cancels every earlier link and keeps existing co-authors. Visitors without a role never receive the token.

## How does a co-author leave or get removed?

```mermaid
sequenceDiagram
    autonumber
    actor M as Owner, album manager or co-author
    participant W as Worker
    participant D as D1
    alt Owner or album manager removes someone
        M->>W: removeMemberFn(albumId, their userId)
    else Co-author leaves
        M->>W: removeMemberFn(albumId, own userId)
    end
    alt Not owner or manager, and not a co-author removing self
        W-->>M: Error Insufficient permissions
    else Allowed
        W->>D: Delete album_member, that user's albumCount - 1 (minimum 0)
        W-->>M: Toast "Co-author removed" or "You left the album"
    end
```

- The page offers no way to remove the owner. The Worker does not refuse it, so only the page protects the owner.
- Photos the co-author uploaded stay. The Leave button is shown to co-authors only, so an admin who joined by link has none.
