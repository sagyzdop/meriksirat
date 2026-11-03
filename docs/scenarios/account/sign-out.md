# Signing out

> **Question:** What happens when a signed-in person chooses
> "Log out" in the sidebar?
>
> **Answer:** The session is ended through the better-auth route
> under `/api/auth`, the app's saved page data is refreshed, and
> the person lands on `/login`.
>
> **Notes:**
> - "Log out" is in the account menu at the bottom of the sidebar.
>   Members and non-members both have it.
> - Only the session of this browser is deleted. Sessions on other
>   devices stay valid.
> - A banned person does not choose this. Their sessions are
>   deleted by the server, see sign-in.md and access-gate.md.

```mermaid
sequenceDiagram
    autonumber
    participant P as Signed-in person
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Open the account menu in the sidebar, click Log out
    B->>W: POST /api/auth/sign-out (better-auth)
    W->>D: Delete the session row of this browser
    W-->>B: Clear session cookie
    B->>B: router.invalidate() reloads route data
    B-->>P: Navigate to /login
```
