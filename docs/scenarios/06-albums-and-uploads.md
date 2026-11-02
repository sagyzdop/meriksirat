# Albums and photo uploads

Everything about photo albums: browsing them signed out or as a member, viewing and downloading photos, creating and editing albums, co-authors, deleting photos and albums, repairing the Drive folder, and uploading photos. Triggered by guests, members, co-authors, owners and admins in the browser.

Which Google Drive account owns what:
- The club (master) Drive account owns the folder tree `Albums/{year}/{month}/{album title}` and the `Volume xxxxxx` subfolders inside each album folder. It makes each album folder readable by anyone with the link.
- The photo files themselves are created by flamekeepers, in their own Drive accounts, inside their volume subfolder (the master shares that subfolder with the flamekeeper's email as writer). They count against the flamekeeper's Drive space.
- Photos are shown straight from Google's image servers, so viewing never uses the Worker or any Drive token.

KV and edge cache entries used here:
- `album:list:{driveFolderId}` holds a folder-state snapshot for 300 seconds.
- `album:detail:{albumId}` holds the viewer-independent album detail for 3600 seconds.
- `album:publist:{hash}` holds one page of the public album list for 600 seconds.
- Each Worker instance also keeps up to 25 of the detail and list entries in memory for 30 seconds.
- Guest page HTML for `/albums` and `/albums/{id}` is cached in the edge Cache API for 60 seconds (per data centre).

## Data

```mermaid
erDiagram
  user ||--o{ album : owns
  album ||--o{ album_member : has
  user ||--o{ album_member : joins
  album ||--o{ photo : contains
  album ||--o{ volume : has
  album ||--o{ upload_reservation : holds
  user ||--o| flamekeeper : is
  user ||--o{ volume : hosts
  user ||--o{ upload_reservation : reserved_on
  photo ||--o{ favorite : liked_by
  user {
    text id PK
    text role "user, manager, admin"
    integer clearanceLevel "3 or more may create albums"
    boolean isMember "canCreateAlbum"
    integer albumCount
    text email
  }
  album {
    text id PK "10 chars"
    text ownerUserId FK
    text title
    text description
    text event
    timestamp eventDate
    text driveFolderId "master-owned folder"
    text coverFileId
    integer photoCount
    integer photoBytes
    integer favoriteCount
    timestamp photosIndexedAt "set at creation"
    timestamp photosIndexRequestedAt
    text photosIndexSkipped "trashed, missing"
    timestamp expiresAt "event date + 2 years"
    boolean pinned
    text tombstoneReason "expired, flamekeeper_left, flamekeeper_lost, no_space"
    timestamp deletedAt
    timestamp expiryReminder30SentAt
    timestamp expiryReminder7SentAt
    text editShareToken "24 chars"
  }
  album_member {
    text id PK
    text albumId FK
    text userId FK
  }
  photo {
    text id PK
    text albumId FK
    text driveFileId
    text name
    integer bytes
    text mimeType
    text flamekeeperUserId "null means master-owned"
    text state "live, moving, deleted, dropped"
  }
  favorite {
    text userId PK
    text photoId PK
  }
  volume {
    text albumId PK
    text flamekeeperUserId PK
    text permissionId
    text driveFolderId "Volume subfolder"
    timestamp releaseLastBlockedAt
    timestamp releaseFirstBlockedAt
    timestamp releaseAlertedAt
  }
  upload_reservation {
    text id PK "16 chars"
    text flamekeeperUserId FK
    text albumId FK
    integer bytes
    timestamp expiresAt "now + 2 hours"
  }
  flamekeeper {
    text userId PK
    integer pledgedBytes
    integer usedBytes
    integer driveUsageBytes
    text state "active, full, draining, lost, drained"
  }
  settings {
    text id PK "global"
    integer flamekeeperCapBytes "default 20 GB"
  }
```

## Browsing albums and opening one

A guest or a member opens `/albums`, a shared album link, `/my-albums` or (admin) `/admin/albums`. Lists page by 24 albums, newest first, by infinite scroll. Album detail data is always rechecked against a fresh album row, while the heavy part is cached.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Guest or Member
  participant Browser
  participant Worker
  participant KV
  participant D1
  participant Drive

  Person->>Browser: opens /albums or /albums/ID
  Browser->>Worker: GET page (HTML)
  alt GET, path /albums or /albums/ID, no Cookie header, accepts text/html, no edit param in URL
    Worker->>Worker: look up edge Cache API
    alt hit
      Worker-->>Browser: stored HTML, header x-guest-html-cache hit
    else miss
      Worker->>Worker: run the app (steps below)
      Worker->>Worker: if status 200 and HTML, store for 60 seconds
      Worker-->>Browser: HTML, header x-guest-html-cache miss
    end
  else signed in, or edit link, or other request
    Worker->>Worker: run the app, never cached
  end

  Note over Browser,Worker: Route loaders run on the Worker. Pages /albums and /albums/ID skip React rendering but still send meta tags
  Browser->>Worker: getUserFn (who is signed in)

  alt page is /albums (public list)
    Browser->>Worker: getPublicAlbumsFn(search, cursor, limit 24)
    Worker->>Worker: rate limit rl_public_albums, 120 per minute per IP
    alt over limit
      Worker-->>Browser: error "Too many requests. Try again in 60 seconds."
    else allowed
      Worker->>KV: read album:publist:hash (memory first, then KV)
      alt cached page
        KV-->>Worker: page of albums
      else miss
        Worker->>D1: albums not deleted, search on title and description, order by created time desc, with owner and co-authors
        Worker->>KV: write album:publist:hash, TTL 600 s
      end
      Worker-->>Browser: albums and nextCursor
    end
  else page is /my-albums
    Browser->>Worker: getMyAlbumsFn(search, ownership, cursor)
    Worker->>D1: albums I own or am a co-author of, same ordering
    Note over Worker: no session returns an empty list. Ownership filter has Owned by me and Shared with me
    Worker-->>Browser: albums and nextCursor
  else page is /admin/albums
    Browser->>Worker: getAllAlbumsFn(search, ownership, cursor)
    Note over Worker: only admin or manager. Anyone else gets an empty list
    Worker->>D1: all albums not deleted
    Worker-->>Browser: albums and nextCursor
  else page is /albums/ID
    Browser->>Worker: getAlbumFn(albumId)
    opt viewer is signed out
      Worker->>Worker: rate limit rl_album_detail, 60 per minute per IP
      Worker-->>Browser: error "Too many requests. Try again in 60 seconds." if over limit
    end
    Worker->>D1: read album row (always fresh)
    alt no row
      Worker-->>Browser: null, page shows "Album not found"
    else row is deleted (expired or removed)
      Worker-->>Browser: tombstone, page shows "This album has expired" or "This album is gone" with Browse albums button
    else live album
      Worker->>D1: work out access: manager if admin or manager, owner, editor if co-author, else none
      Worker->>KV: read album:detail:ID (memory 30 s, KV 3600 s)
      alt core not cached
        alt album already indexed (photosIndexedAt set)
          Worker->>KV: read album:list:FOLDER (300 s)
          opt not cached
            Worker->>Drive: master token, get folder state (ok, trashed or missing)
            Worker->>KV: write album:list:FOLDER with state, TTL 300 s
          end
          Worker->>D1: live photo rows of the album, sorted by capture time
        else not yet indexed
          Worker->>D1: set photosIndexRequestedAt so the background indexer picks it up (see 10-cron-albums-and-housekeeping.md)
          Worker->>Drive: master token, folder state and list of image files
          Worker->>D1: add flamekeeper-owned live photo rows the master cannot see
        end
        Worker->>D1: read owner and co-author names
        opt no cover set yet
          Worker->>D1: set album.coverFileId = earliest uploaded photo
        end
        Worker->>KV: write album:detail:ID, TTL 3600 s
      end
      Worker-->>Browser: album, photos, folderState, expiresAt, pinned, access, edit token only if access is not none
    end
  end
  Browser->>Browser: show page. Album within 30 days of expiry shows banner Will be deleted on DATE
  Browser->>Browser: query keys under albums use stale time 0 (lists) and 15 seconds (detail)
```

## Viewing photos, thumbnails, downloading and sharing

Every album folder is public, so the browser loads images straight from Google's image servers.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Guest or Member
  participant Browser
  participant Google as Drive (Google image servers)

  Person->>Browser: scrolls the photo grid
  loop each thumbnail
    Browser->>Browser: wait for a free slot, at most 6 images loading at once
    Browser->>Google: GET lh3.googleusercontent.com/d/FILE=w600, no referrer
    alt loaded
      Google-->>Browser: image, slot freed
    else failed
      Browser->>Browser: retry after min(1 s x 2 to the attempt, 8 s), at most 5 attempts
      Browser->>Browser: after the 5th failure show a broken-image icon
    end
  end
  Person->>Browser: clicks a photo
  Browser->>Google: GET lh3.googleusercontent.com/d/FILE=w1920 (thumbnail shown while it loads)
  alt Download this photo (lightbox button)
    Browser->>Google: anchor click to drive.usercontent.google.com/download?id=FILE&export=download
    Google-->>Browser: original file as attachment (browser download manager)
  else Download (album header button, shown when the album has photos)
    Browser->>Google: opens drive.google.com/drive/folders/FOLDER in a new tab
    Note over Browser,Google: Drive's own Download button zips the folder. Needs a Google sign-in
  else Share (shown to people who cannot manage the album)
    Browser->>Browser: native share sheet with title, description, authors, link
    alt share sheet unavailable or failed (not cancelled)
      Browser->>Browser: copy text to clipboard, toast "Copied to clipboard", or "Could not copy link"
    end
  end
```

## Creating an album

Members with clearance level 3 or higher click New album on My Albums and fill in title, event, event date and optional description.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Member
  participant Browser
  participant Worker
  participant D1
  participant Drive
  participant Telegram

  Person->>Browser: My Albums, New album
  alt clearance under 3
    Browser->>Browser: button disabled, hint "Album creation requires clearance level 3"
  else allowed
    Person->>Browser: fills title, event, event date, description and clicks Create
    Note over Browser: Create stays disabled until title, event and date are filled
    Browser->>Worker: createAlbumFn(title, description, event, eventDate)
    alt not signed in
      Worker-->>Browser: error Unauthorized
    else clearance under 3
      Worker-->>Browser: error "Album creation requires clearance level 3 or higher"
    else not a club member
      Worker-->>Browser: error "Only club members can create albums"
    else ok
      Worker->>Drive: master token, find or create folders Albums, year (UTC), month name (UTC)
      Worker->>Drive: master token, create folder named after the title
      Worker->>Drive: master token, make folder readable by anyone with the link
      Worker->>D1: insert album, expiresAt = event date + 2 years, edit token 24 chars, photosIndexedAt = now
      Worker->>D1: set user.albumCount = albumCount + 1 for the owner
      Worker->>Telegram: club channel log "Album created" (skipped if logging is off)
      Worker-->>Browser: album id
    end
    alt success
      Browser->>Browser: toast "Album created", close dialog, clear form
      Browser->>Browser: invalidate all albums queries, go to /my-albums with empty filters
    else error
      Browser->>Browser: toast with the error message, or "Failed to create album"
    end
  end
```

## Editing details, setting the cover and pinning

Owners, co-authors and admins or managers see the album manager row on the album page. Pinning is an admin-only button. Automatic expiry itself is in 10-cron-albums-and-housekeeping.md.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Owner, Co-author or Admin
  participant Browser
  participant Worker
  participant D1
  participant Drive
  participant Telegram

  Person->>Browser: Edit details, changes fields, Save
  Note over Browser: Save needs title, event and event date
  Browser->>Worker: updateAlbumFn(albumId, title, description, event, eventDate)
  Worker->>D1: load album (error "Album not found" if missing or deleted)
  Worker->>D1: work out access
  alt access is none
    Worker-->>Browser: error "Insufficient permissions"
  else owner, editor or manager
    opt title changed
      Worker->>Drive: master token, rename the album folder
      alt folder gone from Drive
        Worker-->>Browser: error "The album folder was deleted from Google Drive. Use "Recreate folder" to fix it."
      else other Drive error
        Worker-->>Browser: error "Failed to rename the Drive folder"
      end
    end
    Worker->>D1: update title, description, event, eventDate, updatedAt
    opt event date given and album not pinned
      Worker->>D1: expiresAt = event date + 2 years, clear both expiry reminder timestamps
    end
    Worker->>Worker: clear album:detail:ID cache
    Worker->>Telegram: club log "Album edited" listing what changed
    Worker-->>Browser: success
    Browser->>Browser: toast "Album updated", close dialog, invalidate albums queries
  end

  Person->>Browser: lightbox, Set as cover
  Browser->>Worker: setCoverPhotoFn(albumId, fileId)
  alt not owner, editor or manager
    Worker-->>Browser: error "Insufficient permissions"
  else indexed album and photo not registered
    Worker-->>Browser: error "Photo not found in this album"
  else ok
    Worker->>D1: set album.coverFileId = fileId
    Worker->>Worker: clear album:detail:ID cache
    Browser->>Browser: toast "Cover photo updated", invalidate albums queries
  end

  Person->>Browser: Admin clicks Pin or Unpin
  Browser->>Worker: setAlbumPinnedFn(albumId, pinned)
  alt not admin
    Worker-->>Browser: error "Only admins can pin albums"
  else admin
    Worker->>D1: set album.pinned, updatedAt
    Browser->>Browser: toast "Album pinned" or "Album unpinned", invalidate albums queries
  end
```

## Sharing links, co-authors and leaving

The view link is public. The edit link lets any signed-in user become a co-author (editor).

```mermaid
sequenceDiagram
  autonumber
  participant Person as Owner or Co-author
  participant Joiner as Person opening an edit link
  participant Browser
  participant Worker
  participant D1
  participant Telegram

  Person->>Browser: Share opens dialog with view link and edit link
  Person->>Browser: copy view link
  Browser->>Browser: clipboard gets ready-to-paste text (title, description, authors by Telegram handle, link), toast "Copied to clipboard"
  Person->>Browser: copy edit link
  Browser->>Browser: toast "Link copied", or "Could not copy link"

  Person->>Browser: owner or manager only, Rotate edit link, confirms Rotate link
  Browser->>Worker: rotateEditTokenFn(albumId)
  alt not owner or manager
    Worker-->>Browser: error "Insufficient permissions"
  else ok
    Worker->>D1: new 24 char editShareToken, old links stop working
    Worker->>Telegram: club log "Share link reset"
    Browser->>Browser: new link copied, toast "Edit link rotated - new link copied" (or "Edit link rotated")
  end

  Joiner->>Browser: opens /albums/ID?edit=TOKEN
  alt not signed in
    Browser->>Browser: toast "Please log in to join this album", go to /login
  else signed in
    Browser->>Worker: claimEditAccessFn(albumId, token)
    alt token differs from album's token
      Worker-->>Browser: error "Invalid share link"
      Browser->>Browser: toast with that message
    else token matches
      opt joiner is not the owner
        Worker->>D1: insert album_member (ignored if already a member)
        Worker->>D1: set user.albumCount = albumCount + 1
        Worker->>Worker: clear album:detail:ID cache
        Worker->>Telegram: club log "Editor joined"
      end
      Worker-->>Browser: success
      Browser->>Browser: toast "You are now a co-author of this album"
    end
    Browser->>Browser: replace URL without the edit param, invalidate albums queries
  end

  Person->>Browser: owner or manager clicks the x on a co-author badge
  Browser->>Worker: removeMemberFn(albumId, userId)
  Note over Worker: owner or manager may remove anyone. A co-author may remove only themselves
  alt not allowed
    Worker-->>Browser: error "Insufficient permissions"
  else allowed
    Worker->>D1: delete album_member row
    Worker->>D1: set user.albumCount = max(albumCount - 1, 0) for the removed user
    Worker->>Worker: clear album:detail:ID cache
    Worker->>Telegram: club log "Editor removed" with the removed name
    Browser->>Browser: toast "Co-author removed", invalidate albums queries
  end
  Person->>Browser: co-author clicks Leave album and confirms
  Browser->>Worker: removeMemberFn(albumId, own userId)
  Browser->>Browser: toast "You left the album", go to /my-albums
```

## Deleting a photo, refreshing, and repairing the Drive folder

Any owner, co-author, admin or manager can delete any photo in the album, whoever uploaded it. The Refresh button, the bin banner and the deleted-folder banner are shown to the same people. Banners appear when the cached folder state is trashed or missing.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Owner, Co-author or Admin
  participant Browser
  participant Worker
  participant D1
  participant Drive
  participant Telegram

  Person->>Browser: lightbox, trash icon, confirms Delete
  Browser->>Worker: deletePhotoFn(albumId, fileId)
  alt not owner, editor or manager
    Worker-->>Browser: error "Insufficient permissions"
  else allowed
    Worker->>D1: find photo row by driveFileId in this album
    alt no row and album is indexed
      Worker-->>Browser: error "Photo not found in this album"
    else row belongs to a flamekeeper
      Worker->>Drive: flamekeeper token, batch delete the file (token refreshed and retried once if Drive says 401)
      alt Drive refuses or flamekeeper token fails
        Worker-->>Browser: error such as "Some photos could not be deleted from Drive"
      else flamekeeper is lost or drained and grant is gone
        Worker->>Worker: skip the Drive delete, the file is treated as lost
      else deleted
        Worker->>D1: flamekeeper usedBytes and driveUsageBytes reduced by file bytes
      end
    else master-owned file
      Worker->>Drive: master token, delete file
    end
    Worker->>D1: batch: album photoCount, photoBytes, favoriteCount reduced, delete photo row (favorites go with it)
    Worker->>Worker: clear album:list:FOLDER cache
    opt deleted photo was the cover
      Worker->>D1: set album.coverFileId = null (next view picks the earliest photo)
    end
    Worker->>Worker: clear album:detail:ID cache
    Worker->>Telegram: club log "Photo deleted"
    Browser->>Browser: toast "Photo deleted", invalidate albums queries
  end

  Person->>Browser: Refresh
  Browser->>Worker: refreshAlbumFn(albumId)
  alt not owner, editor or manager
    Worker-->>Browser: error "Insufficient permissions"
  else signed in and over 10 refresh or recreate calls a minute (rl_refresh_album)
    Worker-->>Browser: error "Too many refresh requests. Please try again shortly."
  else ok
    Worker->>Worker: clear album:list:FOLDER and album:detail:ID caches
    Worker->>Drive: master token, folder state
    Worker->>D1: live photo rows, owner and co-authors
    Worker->>Worker: write album:detail:ID, TTL 3600 s
    Browser->>Browser: toast "Album refreshed", invalidate albums queries
  end

  alt banner Album folder is in the Google Drive bin
    Person->>Browser: Restore folder
    Browser->>Worker: restoreAlbumFolderFn(albumId)
    Note over Worker: owner, editor or manager only, else error "Insufficient permissions"
    Worker->>Drive: master token, set folder trashed = false
    Worker->>D1: clear album.photosIndexSkipped if set
    Worker->>Worker: clear album:list:FOLDER and album:detail:ID caches
    Browser->>Browser: toast "Album folder restored", invalidate albums queries
    Note over Browser: if Drive fails the toast shows the error, or "Failed to restore folder"
  else banner Album folder deleted from Google Drive
    Person->>Browser: Recreate folder, confirms Delete photos and recreate
    Browser->>Worker: recreateAlbumFolderFn(albumId)
    alt not owner, editor or manager
      Worker-->>Browser: error "Insufficient permissions"
    else over rate limit
      Worker-->>Browser: error "Too many requests. Please try again shortly."
    else ok
      Worker->>Drive: master token, folder state
      alt folder still exists or is in the bin
        Worker-->>Browser: error "The album folder still exists in Google Drive, so it was not recreated. Refresh the album."
      else Drive error other than not found
        Worker-->>Browser: error "Could not confirm that the album folder is deleted. Nothing was changed. Please try again later."
      else confirmed gone
        Worker->>D1: live photo rows of the album
        Note over Worker: one pass handles at most 200 files from at most 6 owners
        loop each owner group (club account or one flamekeeper)
          Worker->>Drive: batch delete with master token (club files) or the flamekeeper token
          alt file gone, or 404
            Worker->>D1: delete photo row, release flamekeeper bytes
          else retryable (408, 429, 5xx, 403 LimitExceeded, or token error)
            Worker->>Worker: leave the row for the next press
          else refused for good, or the flamekeeper grant is revoked
            Worker->>D1: delete photo row anyway, count as abandoned
            Worker->>Telegram: alert every admin with a Telegram chat, N files of WHO in the recreated album TITLE could not be deleted and were left in their Drive
          end
        end
        alt rows remain after the pass
          Worker-->>Browser: error "Removed X files so far, N to go. Press "Recreate folder" again to continue. The new folder is created once all files are processed."
          Note over Browser: the message adds "N files couldn't be deleted." when some were abandoned. The person presses again
        else all handled
          Worker->>Drive: master token, find or create Albums, year, month, create new folder with the title
          Worker->>Worker: clear album:list:OLDFOLDER and album:detail:ID caches
          Worker->>D1: album.driveFolderId = new folder
          Worker->>D1: delete all photo rows, counts to 0, photosIndexedAt = now, cover cleared, flamekeeper bytes released
          Worker->>D1: every volume of the album loses its Drive folder id and permission id, release counters cleared
          Worker-->>Browser: removed and abandoned counts
          Browser->>Browser: toast "Album folder recreated." plus "X files removed from Google Drive." and "Y files couldn't be deleted." when above zero
          Browser->>Browser: close dialog, invalidate albums queries
        end
      end
    end
  end
```

## Deleting an album

Owner, admin or manager clicks Delete album and confirms. Photos held by flamekeepers are deleted first, then the album folder, then the database row. A very large album can need several tries.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Owner or Admin
  participant Browser
  participant Worker
  participant D1
  participant Drive
  participant Telegram

  Person->>Browser: Delete album, confirms in dialog "Delete album?"
  Browser->>Worker: deleteAlbumFn(albumId)
  alt not owner or manager
    Worker-->>Browser: error "Insufficient permissions"
  else allowed
    Worker->>D1: flamekeeper-owned photo rows (reads up to 2001)
    loop each flamekeeper who owns photos, up to 2000 photos total
      Worker->>Drive: flamekeeper token, batch delete (100 per request)
      alt Drive error or some files refused
        Worker->>D1: delete rows of photos that were deleted, release their bytes
        Worker-->>Browser: error such as "Some photos could not be deleted from Drive"
      else flamekeeper lost or drained with no grant
        Worker->>D1: delete those photo rows, folder will be kept
      else ok
        Worker->>D1: delete photo rows, release flamekeeper bytes
      end
    end
    alt more than 2000 owned photos
      Worker-->>Browser: error "This album is too large to delete in one go. Some photos were deleted, try again to continue."
      Note over Browser: dialog stays open, album still exists. Person clicks Delete album again and it continues
    else folder may be deleted (no lost flamekeeper)
      Worker->>Drive: master token, delete the album folder
      alt folder already gone (404)
        Worker->>Worker: continue
      else Drive says the club account cannot delete a child (flamekeeper volume files remain)
        Worker->>Drive: for up to 4 volumes, list leftover files with flamekeeper token and delete those not in the database
        alt some volume is incomplete (not finished in this attempt)
          Worker-->>Browser: error "This album is too large to delete in one go. Some photos were deleted, try again to continue."
        else nothing blocked and something was cleared, first retry
          Worker->>Drive: master token, delete the album folder again
        else still blocked
          Worker->>Telegram: alert every admin with a Telegram chat that album ID was deleted but its Drive folder or volume subfolders still hold public files needing manual cleanup
          Worker->>Worker: continue and delete the album anyway
        end
      else other Drive error
        Worker->>Worker: log a warning, continue with the database cleanup
      end
      Worker->>Worker: clear album:list:FOLDER and album:detail:ID caches
      Worker->>D1: delete album row (photos, co-authors, volumes, reservations go with it)
      Worker->>D1: set owner albumCount = max(albumCount - 1, 0)
      Worker->>Telegram: club log "Album deleted"
      Worker-->>Browser: success
      Browser->>Browser: toast "Album deleted", invalidate albums queries, go to /my-albums
    end
    Note over Browser: any error toast shows the message, or "Failed to delete album". The dialog stays open
  end
```

## Uploading photos

Owner, co-authors, admins and managers click Upload photos, then drop or choose images. Each file goes through the same steps: the Worker picks a flamekeeper and reserves space, the browser sends the bytes straight to Google Drive, then the Worker registers the photo. The out-of-space message is: `Out of space, become a flamekeeper / ` followed by hash-savenuimg (the initiative name). Becoming a flamekeeper is in 07-flamekeepers.md.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Owner, Co-author or Admin
  participant Browser
  participant Worker
  participant D1
  participant Drive
  participant Google as Drive upload server

  Person->>Browser: Upload photos, drops files or Choose photos
  alt upload button disabled
    Note over Browser: disabled unless the folder is ok. Hints "Restore the album folder from the Drive bin before uploading" or "Recreate the album folder before uploading"
  end
  Browser->>Browser: keep image files only (empty type allowed)
  alt no image files
    Browser->>Browser: toast "Please choose image files"
  else
    Browser->>Browser: skip names already in the album, queued or uploading for it, or repeated in the batch
    alt all skipped
      Browser->>Browser: toast one photo is already in the album, or N photos skipped - already in the album
    else some skipped
      Browser->>Browser: toast N duplicate(s) skipped - already in the album
    end
    Browser->>Browser: save jobs to localStorage and the files to IndexedDB, up to 2 uploads at once
  end

  loop each queued file
    Browser->>Worker: createUploadSessionFn(albumId, fileName, mimeType, size up to 5 GB)
    Worker->>D1: load album and work out access
    alt not owner, editor or manager
      Worker-->>Browser: error "Insufficient permissions"
    else allowed
      Worker->>Drive: master token, folder state
      alt folder in the bin
        Worker-->>Browser: error "The album folder is in the Google Drive bin. Restore it before uploading."
      else folder permanently deleted
        Worker-->>Browser: error from Drive "Drive file not found"
      else ok
        Worker->>D1: live photo with the same name in this album?
        alt duplicate by name
          Worker-->>Browser: error "Photo "NAME" already exists in this album"
        else album not yet indexed
          Worker->>Drive: master token, search the folder for that name
          opt found
            Worker->>D1: register the existing file as a photo row
            Worker-->>Browser: error "Photo "NAME" already exists in this album"
          end
        end
        loop up to 4 placement tries
          Worker->>D1: active and full flamekeepers with pledged, used, drive usage and unexpired reserved bytes
          Note over Worker: only active flamekeepers, never the master account's own email. Space left = smaller of pledge minus used minus reserved, and cap minus Drive usage minus reserved. Cap is settings.flamekeeperCapBytes, default 20 GB. Needs at least the file size. Most space left wins
          alt nobody has room
            Worker-->>Browser: error out-of-space message
          else flamekeeper picked
            Worker->>D1: insert upload_reservation (16 char id, expires in 2 hours) only if used + file + live reservations is within the pledge
            alt reservation refused (race)
              Worker->>Worker: try the next flamekeeper
            else reserved
              Worker->>Drive: master token, find or create the Volume subfolder for this album and flamekeeper, share it with their email as writer
              Worker->>Drive: flamekeeper token, start a resumable upload in that subfolder (token refreshed and retried once on 401)
              alt Drive reports the flamekeeper's storage full
                Worker->>D1: delete reservation, flamekeeper state = full, try next
              else subfolder missing in Drive
                Worker->>D1: delete reservation, forget the subfolder id and recreate it, unless it still holds photos then skip this flamekeeper
              else grant revoked or Drive auth failed
                Worker->>D1: delete reservation, skip this flamekeeper
              else other error
                Worker-->>Browser: that error
              else ok
                Worker-->>Browser: uploadUrl and reservationId
              end
            end
          end
        end
        Note over Worker: after 4 tries with no success, the person gets the out-of-space message
      end
    end

    Browser->>Google: PUT file bytes to uploadUrl, Content-Type text/plain, progress shown
    alt 2xx
      Google-->>Browser: JSON with file id
      opt reply has a file id
        loop up to 3 tries, wait 0.5 s then 1 s
          Browser->>Worker: confirmPhotoUploadFn(albumId, fileId, reservationId)
          Worker->>D1: load reservation for this album
          alt reservation missing
            alt photo already registered
              Worker-->>Browser: registered false (treated as done)
            else
              Worker-->>Browser: error "Upload session expired, upload again"
            end
          else found
            Worker->>Drive: flamekeeper token, read file info
            alt file not in the flamekeeper's volume subfolder or in the bin
              Worker-->>Browser: error "Uploaded file not found in the album folder"
            else not an image
              Worker->>Drive: flamekeeper token, delete the file
              Worker->>D1: delete reservation
              Worker-->>Browser: registered false
            else image
              Worker->>D1: insert photo row (state live, flamekeeperUserId set), album photoCount and photoBytes up
              Worker->>D1: batch: flamekeeper usedBytes and driveUsageBytes up by file size, delete reservation
              Worker-->>Browser: registered true
            end
          end
        end
        Note over Browser: after 3 failed confirms the job counts as a temporary failure and is queued again
      end
      Browser->>Browser: job done at 100 percent, file removed from IndexedDB
      Browser->>Browser: when every job of the album is finished, invalidate albums queries and refresh the page data
      Note over Browser,Worker: confirming does not clear album:detail:ID. The album page may show the cached photo list until Refresh, another edit, or the cache expires (up to 1 hour)
    else 403 storageQuotaExceeded
      Browser->>Worker: releaseUploadFn(albumId, reservationId, quotaExceeded true)
      Worker->>D1: delete reservation, flamekeeper state = full
      Browser->>Browser: treated as a temporary failure, retried (a different flamekeeper is chosen)
    else 408, 429, 5xx, network error or timeout
      Browser->>Worker: releaseUploadFn(albumId, reservationId, quotaExceeded false)
      Worker->>D1: delete reservation
      Browser->>Browser: temporary failure, retried
    else any other status
      Browser->>Worker: releaseUploadFn(albumId, reservationId, quotaExceeded false)
      Browser->>Browser: job error "Upload failed (STATUS)"
    end
    Note over Worker: releaseUploadFn needs owner, editor or manager access, else "Insufficient permissions". It does nothing if the reservation is not found
  end
```

## Upload queue behaviour in the browser

What the person sees while jobs run, fail, are cancelled or survive a page reload. No server call is made here except the same three upload functions.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Owner, Co-author or Admin
  participant Browser
  participant Worker

  Browser->>Browser: run at most 2 jobs at once, status queued, uploading, done, error or cancelled
  alt temporary failure (network error, timeout, 408, 429, 5xx, full flamekeeper, failed confirm, fetch rejected)
    Browser->>Browser: attempts under 5, wait min(1 s x 2 to the attempt minus 1, 30 s) plus or minus 20 percent, then queue again
    Browser->>Browser: 5th failure ends as error "Upload failed after 5 attempts - retry manually"
  else server message error (for example out of space, duplicate, "Insufficient permissions")
    Browser->>Browser: job error shows the server message, no automatic retry
  else server says "already exists in this album"
    Browser->>Browser: job counted as done
  end

  Person->>Browser: clicks X on a queued or uploading job
  Browser->>Browser: abort the transfer, status cancelled, file removed from IndexedDB
  Person->>Browser: clicks the retry arrow on an error job
  alt file still stored
    Browser->>Browser: status queued, progress 0, attempts 0, run again from createUploadSessionFn
  else file lost
    Browser->>Browser: job error "File is no longer available - choose it again"
  end
  Person->>Browser: Clear finished
  Browser->>Browser: remove done, error and cancelled jobs of this album
  Browser->>Browser: every minute remove done or cancelled jobs after 1 hour, error jobs after 7 days

  Person->>Browser: reloads the page mid-upload
  Browser->>Browser: restore jobs from localStorage, uploading ones go back to queued at 0 percent
  Browser->>Browser: read files from IndexedDB
  alt file missing for a job
    Browser->>Browser: job error "File is no longer available - choose it again"
  end
  Browser->>Browser: wait 0.4 s, then resume queued jobs. The attempts count is kept
  Person->>Browser: clicks the Uploading photos bar on the album page or header widget
  Browser->>Browser: opens the upload list of that album
  Browser->>Worker: resumed jobs call createUploadSessionFn again, see Uploading photos above
```
