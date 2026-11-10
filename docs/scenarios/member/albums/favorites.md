# Favorites

Favorites are saved album photos, not equipment. Any signed-in user may favorite, members and non-members alike, and `/favorites` is open to both ([GLOSSARY](../../../../GLOSSARY.md)).

## What happens when a user taps the heart on a photo?

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant B as Browser
    participant W as Worker
    participant D as D1
    U->>B: Tap the heart on an album photo
    B-->>U: Heart flips at once
    B->>W: setFavoriteFn(albumId, driveFileId, favorite)
    opt Favoriting
        W->>W: Check the file in the album's cached listing
        Note over W: Only a complete listing that lacks the file refuses "Photo not found in this album"
    end
    alt Refused
        W-->>B: Error
        B-->>U: Heart flips back, error toast
    else Saved
        W->>D: Batch: change album favorite_count by 1 only if the state changes, insert or delete the favorite
        W-->>B: OK
    end
    B->>B: Invalidate every favorites query and reload
```

- A favorite is keyed by user, album and Drive file id. The count never drifts on repeated taps and never drops below 0.
- When a photo moves to a new Drive file, favorites and the album cover are remapped to the new id.

## What does My Favorites show?

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant K as D1 app_state
    U->>B: Open My Favorites
    B->>W: listMyFavoritesFn()
    W->>D: Favorites joined to live albums, newest first, up to 1000
    W->>K: Cached listings for at most 20 albums
    W-->>B: Photos with album id and title
    B-->>U: Photo grid with filled hearts, or "No favorites yet"
    U->>B: Tap a filled heart
    B->>W: setFavoriteFn(favorite false)
    B-->>U: Photo disappears after the reload
```

- The page makes no Drive calls. A photo whose listing is not cached or incomplete still shows, named "Photo". A photo missing from a complete listing is left out silently.
- Unlike the album page, nothing changes until the server answers.
- A load failure is only logged and shows the empty state.
