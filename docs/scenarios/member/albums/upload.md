# Upload photos

Related: [failures and retries](upload-failures.md), [ADR-0015](../../../adr/0015-buffer-is-stable-photo-storage.md), [ADR-0017](../../../adr/0017-drop-photo-table-read-from-drive.md), [ADR-0019](../../../adr/0019-256mb-volumes-several-per-holder.md).

## How does a photo get from the browser to the buffer's Drive?

The owner, co-authors and album managers can upload. The bytes go straight from the browser to Google, never through the Worker.

```mermaid
sequenceDiagram
    autonumber
    actor M as Uploader
    participant B as Browser
    participant W as Worker
    participant G as Drive
    M->>B: Choose or drop image files
    B->>B: Skip duplicates already queued, save jobs (localStorage) and files (IndexedDB), run 2 at a time
    B->>W: createUploadSessionFn(albumId, name, type, size)
    W->>G: Master token: folder state
    W->>W: Compare size with the album listing
    opt A listed photo has the same size
        W-->>B: Ask for the MD5
        B->>W: Same call with the MD5 of the file
    end
    alt Same size and MD5 as a listed photo
        W-->>B: Error, photo already exists
    else New photo
        W->>W: startBufferUpload (next diagram)
        W-->>B: One-time upload address
    end
    B->>G: PUT the bytes to the upload address
    G-->>B: New file id
    B->>W: confirmPhotoUploadFn(albumId, fileId)
    W->>G: Buffer token: read the file
    alt Not in one of the album's buffer Volume folders
        W-->>B: Error Uploaded file not found in the album folder
    else Not an image
        W->>G: Delete the file
        W-->>B: registered false
    else Image
        W-->>B: registered true (counts go up unless the listing already shows it)
    end
    B->>B: When all jobs finish, reload the album
```

- Files up to 5 GB. Filenames are ignored for duplicate detection: size first, then MD5 hashed in the browser only when a size matches.
- The queue survives a page refresh. A job whose file is gone fails with "File is no longer available — choose it again".
- Uploads are paused while the album folder is in the bin or deleted, see [warnings](warnings.md).
- Confirming adds 1 and the file size to the Volume's expected count and bytes and to the album's photo count and bytes. A confirm for a file the cached buffer listing already shows is accepted without adding.

## Where does the photo go?

```mermaid
flowchart TD
    A["startBufferUpload"] --> B{"Buffer configured and token works?"}
    B -- no --> X1["Error: photo storage not available, tell an admin"]
    B -- yes --> C{"Buffer usage at 100 percent? (cached, refreshed after 10 minutes)"}
    C -- yes --> X2["Error: storage is full, photos stay on the device"]
    C -- no --> D{"Newest buffer Volume has room for this file within 256 MB?"}
    D -- yes --> F["Reuse that Volume folder"]
    D -- no --> E["Master creates a new Volume folder in the album folder and shares it with the buffer as editor"]
    E --> F
    F --> G["Buffer token asks Google for a resumable upload address"]
    G --> H["Only the address goes to the browser"]
```

- Every new photo goes to the buffer. There is no fallback to a flamekeeper. See the glossary for [Volume](../../../../GLOSSARY.md).
- A Volume folder that vanished from Drive is recreated once, and only while that Volume has no photos. Otherwise the upload stops with "The album storage folder could not be found in Google Drive, so uploads are paused."
- Photos that flamekeepers held before the buffer stay where they are, see [legacy](legacy.md).
