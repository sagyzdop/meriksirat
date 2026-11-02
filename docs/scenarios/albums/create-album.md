# Create an album

> **Question:** What happens when a member creates a new album, and whose Google Drive holds it?
>
> **Answer:** A club member with clearance level 3 or higher fills in title, event, event date and an optional description. The Worker uses the club's master Google account to create the folder Albums / year / month / title in the master's Drive and makes it readable by anyone with the link. It saves the album with an expiry 2 years after the event date and a fresh edit token, then the member lands on My Albums with the toast "Album created". The empty folder lives in the master account, and no photos are stored there. Each photo goes to a flamekeeper's Drive later, when it is uploaded.
>
> **Notes:**
> - The master account `nu_image` never holds uploaded photos. It only owns the album folder and the "Volume" sub-folders that flamekeepers upload into, see upload-start.md.
> - No flamekeeper is chosen at creation. The flamekeeper is chosen per photo.
> - The month folder uses the current UTC date, not the event date.
> - The album is saved as already indexed, so it is read from the photo table from the start. Older albums are not, see legacy-albums.md.
> - If the database save fails after the Drive folder was made, the empty folder stays in Drive and no album row exists.
> - Expiry and reminders are handled by cron, see ../cron/albums-and-housekeeping/.
> - The Telegram log line is only sent when channel logging is enabled.

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant G as Drive
    participant T as Telegram
    M->>B: My Albums, click New album
    Note over B: Button is greyed out under clearance 3.<br/>Hover text: Album creation requires<br/>clearance level 3
    M->>B: Fill the form and click Create
    Note over B: Create stays disabled until title, event<br/>and date are filled. Title and event max 200,<br/>description max 1000 characters
    B->>W: createAlbumFn(title, description, event, eventDate)
    alt Not signed in
        W-->>B: Error Unauthorized
    else Clearance level under 3
        W-->>B: Error Album creation requires clearance<br/>level 3 or higher
    else Not a club member
        W->>D: Check the canCreateAlbum rule for the user
        W-->>B: Error Only club members can create albums
    else Allowed
        W->>G: Master token: find or create Albums, year, month
        W->>G: Master token: create folder named after the title
        W->>G: Master token: make folder readable by anyone with link
        W->>D: Insert album: owner, 10 character id,<br/>24 character edit token,<br/>expiresAt = event date + 2 years
        W->>D: Add 1 to the owner's albumCount
        W->>T: Log "created" to the club channel
        W-->>B: id of the new album
        B->>M: Toast "Album created", dialog closes
        B->>B: Invalidate all albums queries, go to My Albums
    end
    opt Drive or database error
        W-->>B: Error message
        B->>M: Red toast with the message, or "Failed to create album"
    end
```
