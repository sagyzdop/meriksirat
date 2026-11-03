# How equipment photos are shown

> **Question:** How does an equipment photo get from storage to the
> screen?
>
> **Answer:** Cards and the detail page ask the Worker for
> `/api/images/` followed by the stored image path. The Worker checks
> that the user is signed in and under the image rate limit of 300
> requests per minute, then reads the file from the R2 bucket and
> sends it with a one-day private cache. If the file cannot be
> loaded, the page shows a grey placeholder icon instead.
>
> **Notes:**
> - The statuses returned are 400 "Image path is required", 401
>   "Unauthorized", 429 "Too Many Requests", 404 "Image not found",
>   500 "Storage not configured" and 500 "Internal server error".
> - When the browser asks again with its saved ETag, R2 compares it
>   and the Worker answers 304 with no body.
> - The route reads any path in the bucket for any signed-in user,
>   not only equipment images. A banned user counts as signed out,
>   and the check also deletes that user's sessions.
> - Album photos do not use this route. They load from Google's image
>   servers by Drive file id, see `../albums/view-album.md`.
> - Equipment with no image path shows the placeholder without a
>   request. Uploading an image is an admin action, see
>   `../admin/edit-equipment.md`.
> - The rate limit is counted per user. If the limiter is missing or
>   fails, the request is let through.

```mermaid
sequenceDiagram
    autonumber
    actor U as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant R as R2
    B->>B: card has image path?
    alt No image path
        B-->>U: Grey placeholder icon
    else Has image path
        B->>W: GET /api/images/equipment-images/ID.jpg
        alt Path part is empty
            W-->>B: 400 "Image path is required"
        else Path present
            W->>D: resolve session, check not banned
            alt No valid session
                W-->>B: 401 "Unauthorized"
            else Signed in
                W->>W: rate limit rl_images, 300 per 60 s per user
                alt Over the limit
                    W-->>B: 429 "Too Many Requests"
                else Allowed
                    W->>R: if bucket exists, get object with the<br/>browser's If-None-Match
                    alt Bucket binding missing
                        W-->>B: 500 "Storage not configured"
                    else Object missing
                        W-->>B: 404 "Image not found"
                    else Browser copy still current
                        W-->>B: 304 no body
                    else Object found
                        W-->>B: 200 image, private cache 86400 s, ETag
                    end
                end
            end
        end
        opt Request failed
            B-->>U: Grey placeholder icon
        end
    end
```
