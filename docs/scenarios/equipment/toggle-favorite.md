# Favoriting a photo

> **Question:** What happens when a signed-in user taps the heart on
> a photo in an album?
>
> **Answer:** The heart fills or empties at once, and the change is
> saved in the background. If saving fails, the heart goes back and
> the user sees a toast with the error text. Either way, all
> favorites data is then reloaded. Saving adds or removes the user's
> favorite for that photo and moves the album's favorite count up or
> down by one.
>
> **Notes:**
> - The heart appears only for signed-in users. A filled heart is
>   always visible. An empty one on the grid is hidden until hover on
>   large screens and always visible on phones. The enlarged photo
>   view uses the same control.
> - The list of hearted photos in an album is loaded once per album
>   and reused for 30 seconds. It holds only live photos and is empty
>   for a user who is not signed in.
> - A photo that is not yet in the database is looked up in the
>   album's Drive folder with the master account and added. This
>   happens only when favoriting, only when the album has never
>   been fully indexed, and only when the page did not send a photo
>   id. A file that is not an image is not added, and the user sees
>   "Photo not found in this album".
> - The count goes up only if the user had not already favorited
>   the photo, and down only if they had, so repeated taps do not
>   drift the count. It never goes below 0.
> - The toast shows the text of whatever error the server raised.
>   Examples are "Sign in to favorite photos", "You cannot favorite
>   photos", "Album not found", "Photo not found in this album",
>   "Uploaded file not found in the album folder", or an error text
>   from Drive. "Could not update favorite" shows only when the
>   error has no text of its own.
> - The favorites page is described in `favorites-page.md`.
> - Loading an album page is described in `../albums/view-album.md`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Signed-in user
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant G as Drive
    B->>W: getAlbumFavoritesFn(albumId)
    W->>D: read this user's favorites for live photos<br/>in the album
    W-->>B: list of photo ids (empty if not signed in)
    B-->>U: Hearts drawn on favorited photos
    U->>B: Tap the heart
    B-->>U: Heart flips at once
    B->>W: setFavoriteFn(albumId, photoId,<br/>driveFileId, favorite)
    W->>D: load session, check user may favorite
    alt Not signed in or not allowed
        W-->>B: error "Sign in to favorite photos"<br/>or "You cannot favorite photos"
    else Allowed
        W->>D: read the album, then the live photo in it
    end
    opt Album found, photo unknown, no photo id,<br/>album never indexed, favoriting
        W->>G: read file info (master account token)
        alt File not in the album folder or in trash
            W-->>B: error "Uploaded file not found in the album folder"
        else Image file
            W->>D: add photo row, then look it up again
        end
    end
    alt Album or photo missing
        W-->>B: error "Album not found" or<br/>"Photo not found in this album"
    end
    alt Server returned an error
        B-->>U: Heart flips back, error toast
    else Favoriting
        W->>D: batch: add 1 to album favorite_count if not yet<br/>favorited, insert favorite (ignore duplicate)
        W-->>B: photoId and favorite true
    else Unfavoriting
        W->>D: batch: subtract 1 (not below 0) if favorited,<br/>delete favorite
        W-->>B: photoId and favorite false
    end
    B->>B: invalidate all queries starting with favorites
    B->>W: getAlbumFavoritesFn(albumId) again
```
