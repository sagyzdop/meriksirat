# Favoriting a photo

> **Question:** What happens when a signed-in user taps the heart on a
> photo in an album?
>
> **Answer:** The heart fills or empties at once, and the change is saved
> in the background. If saving fails the heart goes back and the user sees
> a toast with the error text. Afterwards all favorites data is reloaded.
> Saving adds or removes the user's favorite for that photo and moves the
> album's favorite count up or down by one.
>
> **Notes:**
> - The heart appears only for signed-in users. On the grid it is hidden
>   until hover on large screens and always visible on phones. The
>   enlarged photo view uses the same control.
> - The set of hearted photos in an album is loaded once per album and
>   kept for 30 seconds. It lists only live photos.
> - Photos not yet in the database are looked up in the album's Drive
>   folder with the master account and added, but only when favoriting,
>   only when the album has never been fully indexed, and only when the
>   page did not send a photo id.
> - Counts change only if the favorite did not already exist (or does),
>   so repeated taps do not drift the count. The count never goes below 0.
> - Error texts include "Sign in to favorite photos", "You cannot
>   favorite photos", "Album not found", "Photo not found in this album"
>   and "Uploaded file not found in the album folder". Anything else shows
>   "Could not update favorite".
> - The favorites page is described in `favorites-page.md`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Signed-in user
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant G as Drive
    B->>W: getAlbumFavoritesFn(albumId)
    W->>D: read this user's favorites for live photos in the album
    W-->>B: list of photo ids (empty if not signed in)
    B-->>U: Hearts drawn on favorited photos
    U->>B: Tap the heart
    B-->>U: Heart flips at once
    B->>W: setFavoriteFn(albumId, photoId, driveFileId, favorite)
    W->>D: load session, check user may favorite
    W->>D: read album, then the live photo in it
    alt Photo unknown, no photo id, album never indexed, favoriting
        W->>G: read file info (master account token)
        alt File not in the album folder or in trash
            W-->>B: error "Uploaded file not found in the album folder"
        else Image file
            W->>D: add photo row, then look it up again
        end
    end
    alt Not signed in, album or photo missing
        W-->>B: error text
        B-->>U: Heart flips back, error toast
    else Favoriting
        W->>D: batch: add 1 to album favoriteCount if not yet<br/>favorited, insert favorite (ignore duplicate)
        W-->>B: photoId and favorite true
    else Unfavoriting
        W->>D: batch: subtract 1 (not below 0) if favorited,<br/>delete favorite
        W-->>B: photoId and favorite false
    end
    B->>B: invalidate all queries starting with favorites
    B->>W: getAlbumFavoritesFn(albumId) again
```
