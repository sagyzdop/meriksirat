# Recreate a deleted album folder

> **Question:** What happens when an album's Drive folder was permanently deleted and someone clicks "Recreate folder"?
>
> **Answer:** The button appears on the red "Album folder deleted from Google Drive" notice for the owner, co-authors and admins or managers, and asks for confirmation. The Worker first proves the folder is really gone. Only then does it delete the album's photos from the flamekeepers' Drives, up to 200 files and 6 flamekeepers per press, and when none are left it creates a new empty folder, resets the album's photo list and cover, and the page shows a toast starting "Album folder recreated." followed by how many files were removed and how many could not be deleted. If any check fails, nothing is deleted and the person sees why. Large albums need several presses.
>
> **Notes:**
> - Checks that happen before any file is deleted: the caller's role, a limit of 10 requests a minute per person (shared with the Refresh button), and the folder check. The folder check must come back "deleted". "Exists in the bin or live" is refused, and a Drive error while checking is also refused, so doubt never causes a delete.
> - A file counts as gone when Google says it is deleted or already missing. Temporary Google answers are tried again on the next press. A flamekeeper whose access was revoked, or a Google refusal, makes those files "could not be deleted": their table rows are dropped so they do not block the album, the files stay in that flamekeeper's Drive, and admins get a Telegram message naming them.
> - The Telegram message to admins reads: #savenuimg: N files of NAME (EMAIL) in the recreated album "TITLE" could not be deleted and were left in their Drive. For files held by the master account it says "the club account" instead of a name.
> - The "keep pressing" error continues: "... Press "Recreate folder" again to continue. The new folder is created once all files are processed." When some files were refused it also says how many files couldn't be deleted.
> - The 200 files are counted across at most 6 owners per press, and the master account counts as one owner. Files of further owners wait for the next press.
> - Everything in the photo table for the album is cleared when the new folder is made, including rows in other states such as dropped photos. The refused files' rows are already gone by then.
> - After a successful recreate, every volume of the album forgets its folder, so the next upload to each flamekeeper creates a new Volume folder.
> - Restoring a folder that is only in the bin is a different, harmless action, see restore-folder.md.

```mermaid
sequenceDiagram
    autonumber
    participant M as Owner, co-author or admin
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant G as Master Drive
    participant F as Flamekeeper Drive
    participant T as Telegram
    M->>B: Click Recreate folder, then Delete photos and recreate
    B->>W: recreateAlbumFolderFn(albumId)
    W->>D: Load album and the caller's role
    alt Album missing, deleted or caller has no role
        W-->>B: Error Album not found or Insufficient permissions
    else Allowed
        W->>W: rl_refresh_album, 10 per 60 seconds per user
        alt Rate limited
            W-->>B: Error Too many requests. Please try again shortly.
        else Allowed
            W->>G: Master token: folder state
            alt Folder still exists or is in the bin
                W-->>B: Error The album folder still exists in Google Drive,<br/>so it was not recreated. Refresh the album.
            else Drive error while checking
                W-->>B: Error Could not confirm that the album folder is deleted.<br/>Nothing was changed. Please try again later.
            else Folder confirmed deleted
                W->>D: Live photos, up to 200 files from 6 owners
                W->>F: Each owner's token (master for old files): delete in batch
                W->>D: Drop rows of deleted or refused files, give back bytes
                opt Some files refused by Drive
                    W->>T: Alert admins naming the flamekeeper
                end
                alt Files remain
                    W-->>B: Error Removed N files so far, M to go.<br/>Press "Recreate folder" again to continue.
                else All processed
                    W->>G: Master token: create new folder, anyone can read
                    W->>D: Save new driveFolderId, empty photo list, no cover
                    W->>D: Clear every volume's folder id for the album
                    W-->>B: removed and abandoned counts
                    B->>M: Toast "Album folder recreated." with counts
                end
            end
        end
    end
    opt Any error
        B->>M: Red toast with the message, or "Failed to recreate folder"
    end
```
