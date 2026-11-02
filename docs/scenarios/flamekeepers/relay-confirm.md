# Confirm a moved photo

> **Question:** What does the server do once the browser says a photo has been copied to the new Drive?
>
> **Answer:** It checks the reservation, looks up the copy in the destination Drive, and checks it sits in the right album folder and has the same size as the original. If so, the photo record now points to the new file and the new flamekeeper, the destination's used space goes up, the old file is deleted from the source Drive, and the source's used space goes down. If the photo changed in the meantime or the copy is wrong, the copy is deleted instead. The reply tells the browser how much is left to move.
>
> **Notes:**
> - Which token is used. The destination flamekeeper's token reads
>   the copy's details and deletes the copy when discarding. The
>   source flamekeeper's token deletes the old file. Both are
>   looked up on the server, never sent by the browser.
> - A stale move means the photo was deleted, is no longer live,
>   or no longer sits with the source. The extra copy is deleted,
>   the reservation is removed and the call still succeeds.
> - If the old file cannot be deleted (other than "already gone")
>   the move still counts and a warning is logged. The old file
>   then stays in the source Drive.
> - If the photo was the album cover, the cover is repointed to
>   the new file.
> - When the source holds nothing more, empty album folders are
>   released and the drain is finished: state becomes drained and
>   the Drive access is deleted.
> - The cached album page is dropped so viewers get the new file.
> - Admin callers pass the source person's id, as in
>   relay-hand-out.md.

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Worker
    participant D1
    participant Drive
    Browser->>Worker: confirmRelayFn(photoId, reservationId,<br/>fileId, userId or none)
    Worker->>D1: read the reservation
    alt Reservation gone
        Worker-->>Browser: error "Move session expired, try again"
    else Destination is the source
        Worker-->>Browser: error "Invalid move session"
    else Reservation found
        Worker->>Drive: destination token reads the copy
        alt Copy is not in the destination album folder
            Worker-->>Browser: error "Moved copy not found in the<br/>album folder"
        else Photo changed or copy size differs
            Worker->>Drive: destination token deletes the copy
            Worker->>D1: delete the reservation
            alt Size differs
                Worker-->>Browser: error "The moved copy was incomplete,<br/>try again"
            else Photo no longer live or moved already
                Worker-->>Browser: current drain status
            end
        else Copy is good
            Worker->>D1: photo = new file id and destination,<br/>only if still with the source
            Worker->>D1: destination used bytes plus size,<br/>delete reservation, fix album cover
            Worker->>Drive: source token deletes the old file
            Worker->>D1: source used bytes minus size,<br/>release empty album folders
            Worker->>D1: finish the drain if nothing is left
            Worker-->>Browser: status with bytes left
        end
    end
```
