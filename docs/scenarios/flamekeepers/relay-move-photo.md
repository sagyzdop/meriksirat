# Copy one photo between Drives in the browser

> **Question:** How does the browser copy a photo to the new flamekeeper, and what happens when the copy fails?
>
> **Answer:** The browser downloads the photo from the source Drive with the source token, then uploads the bytes to the upload link for the destination folder. If both succeed it tells the server to confirm the move, and the loop asks for the next photo. If a step fails, the browser tells the server to release the reserved space, then retries after a short wait. After 3 failures in a row it stops and shows the error. The Pause button stops the loop after the current step.
>
> **Notes:**
> - Photos move one at a time through the browser of whoever
>   pressed the button. Closing the tab asks for confirmation
>   while moving, and the loop stops if the page is left.
> - Waits between retries are 1 s, then 2 s. The third failure in
>   a row stops with "Moving stopped: " followed by the error.
>   Any success resets the count.
> - The release call is sent without waiting and its own failure
>   is ignored. The reservation also expires by itself after 2
>   hours.
> - If the destination Drive says its storage is exceeded, the
>   release marks that flamekeeper as full, so no further photos
>   are placed there.
> - The server side of a successful copy is in relay-confirm.md.
> - Progress text: "Preparing the next photo...", then "Moved
>   name", with "N photos moved so far" and a progress bar.

```mermaid
sequenceDiagram
    autonumber
    actor P as Flamekeeper or Admin
    participant Browser
    participant Worker
    participant Drive
    Note over Browser,Worker: Handout from relay-hand-out.md
    Browser->>Drive: GET file alt=media<br/>(source flamekeeper token)
    alt Download fails
        Browser->>Worker: releaseRelayFn(albumId, reservationId,<br/>quotaExceeded false)
        Note over Browser: error "Could not download name (status)"
    else Download ok
        Browser->>Drive: PUT bytes to the upload link<br/>(no token needed)
        alt Destination storage exceeded (403)
            Browser->>Worker: releaseRelayFn(..., quotaExceeded true)
            Note over Worker: reservation deleted and that<br/>flamekeeper marked full
            Note over Browser: error "Destination Drive is full"
        else Any other upload failure
            Browser->>Worker: releaseRelayFn(..., quotaExceeded false)
            Note over Browser: error "Could not upload name (status)"
        else Upload ok but no file id returned
            Browser->>Worker: releaseRelayFn(..., quotaExceeded false)
            Note over Browser: error "Google did not return the<br/>moved file"
        else Upload ok
            Browser->>Worker: confirmRelayFn(photoId, reservationId,<br/>fileId), see relay-confirm.md
            Worker-->>Browser: status with bytes left
            Browser-->>P: "Moved name" and the new GB left
        end
    end
    alt Third failure in a row
        Browser-->>P: "Moving stopped: error message"
    else Fewer than 3 failures
        Browser->>Browser: wait 1 s times failures, ask again
    end
    opt Status is no longer draining
        Browser-->>P: "All photos have moved. Thank you!"
        Browser->>Browser: invalidate flamekeepers queries<br/>and reload the route
    end
```
