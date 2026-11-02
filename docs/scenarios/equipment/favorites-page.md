# My favorites page

> **Question:** What does the My Favorites page show, and how does a
> user remove a photo from it?
>
> **Answer:** It lists the photos the user has hearted in any album, newest
> favorite first, up to 1000, and only photos that are still live. With
> none, it says "No favorites yet" and "Tap the heart on a photo in any
> album to save it here." Tapping the filled heart removes the photo after
> the server confirms, then the list reloads.
>
> **Notes:**
> - Available to members and non-members alike. Not signed in users are
>   sent to login first.
> - Unlike the album page, nothing is changed on screen until the server
>   has answered.
> - Removing uses the same save step as `toggle-favorite.md`, so the
>   album's favorite count also drops by one.
> - If loading fails the error is only logged and the page shows its
>   empty state. A skeleton shows while loading.
> - The list is never cached beyond the moment (stale time 0), so each
>   visit reloads it.

```mermaid
sequenceDiagram
    autonumber
    actor U as Signed-in user
    participant B as Browser
    participant W as Worker
    participant D as D1
    U->>B: Click My Favorites in the sidebar
    B->>W: listMyFavoritesFn()
    W->>D: load session, check user may favorite
    alt Not signed in or not allowed
        W-->>B: error "Sign in to favorite photos"
        B-->>U: Empty state "No favorites yet"
    else Allowed
        W->>D: read favorites joined to live photos and<br/>albums, newest first, limit 1000
        W-->>B: photos with album id and title
        B-->>U: Photo grid, all hearts filled
    end
    U->>B: Tap a filled heart
    B->>W: setFavoriteFn(albumId, photoId, driveFileId, favorite false)
    alt Server refuses or fails
        W-->>B: error
        B-->>U: Toast with the error text, or<br/>"Could not update favorite"
    else Removed
        W->>D: batch: subtract 1 from album favoriteCount,<br/>delete favorite
        W-->>B: photoId and favorite false
        B->>B: invalidate all queries starting with favorites
        B->>W: listMyFavoritesFn()
        W-->>B: updated list
        B-->>U: Photo gone from the grid
    end
```
