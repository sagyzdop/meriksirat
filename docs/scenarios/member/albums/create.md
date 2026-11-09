# Create and edit an album

Related: [upload](upload.md), [co-authors](co-authors.md), [ADR-0005](../../../adr/0005-album-drive-folders-are-always-public.md).

## What happens when a member creates an album?

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant W as Worker
    participant G as Master Drive
    participant D as D1
    participant T as Telegram
    M->>W: createAlbumFn(title, description, event, eventDate)
    alt Not signed in, clearance under 3, or not a club member
        W-->>M: Error, nothing created
    else Allowed
        W->>G: Find or create Albums / year / month, create folder named after the title
        W->>G: Make the folder readable by anyone with the link
        W->>D: Insert album with a 10 character id and a 24 character edit token
        W->>D: Owner albumCount + 1
        W->>T: Log "created" to the club channel
        W-->>M: Album id, toast "Album created", go to My Albums
    end
```

- The folder belongs to the master account. It holds no photos. Photos are uploaded later into Volume folders owned by the buffer, see [upload](upload.md).
- The member flag set by an admin is required, and clearance level 3 or higher. Clearance alone is not enough.
- The month folder uses the current UTC date, not the event date.
- Albums do not expire. They are deleted only by their owner or an admin, or on a date an admin schedules, see [delete-album](delete-album.md) and the [GLOSSARY](../../../GLOSSARY.md).
- If the database insert fails after the folder was made, the empty folder stays in Drive.

## What happens when someone edits the details?

```mermaid
sequenceDiagram
    autonumber
    actor M as Owner, co-author or album manager
    participant W as Worker
    participant G as Master Drive
    participant D as D1
    M->>W: updateAlbumFn(albumId, title, description, event, eventDate)
    alt No role on the album
        W-->>M: Error Insufficient permissions
    else Allowed
        opt Title changed
            W->>G: Rename the album folder
            Note over W,G: If the rename fails nothing is saved
        end
        W->>D: Save fields
        W-->>M: Toast "Album updated"
    end
```

Pinning is an admin action, see [admin albums](../../admin/albums/).
