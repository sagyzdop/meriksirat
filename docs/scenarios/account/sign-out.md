# Signing out

> **Question:** What happens when a signed-in person clicks log
> out in the sidebar?
>
> **Answer:** The session is ended through the better-auth route
> `/api/auth`, the app's cached route data is refreshed, and the
> person lands on `/login`.
>
> **Notes:**
> - A banned user does not choose this. Their sessions are
>   deleted on the server, see sign-in.md and access-gate.md.

```mermaid
sequenceDiagram
    autonumber
    participant P as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Click log out in the sidebar
    B->>W: POST /api/auth sign-out (better-auth)
    W->>D: Delete the session row
    W-->>B: Clear session cookie
    B->>B: router.invalidate() reloads route data
    B-->>P: Navigate to /login
```
