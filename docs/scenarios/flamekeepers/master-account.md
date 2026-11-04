# Keep the club account out of the pool

> **Question:** What stops the club account (nu_image, the master account) from becoming a flamekeeper?
>
> **Answer:** The club account owns every album folder, so it must never become a flamekeeper. It is refused at two points: when it starts the Drive connection, and when Google returns (if either the signed-in email or the Google email matches it). It also cannot be banned. Because it never gets a flamekeeper row, nothing can end its flamekeeping.
>
> **Notes:**
> - The club account is identified by comparing the email, ignoring
>   case and spaces, with the GOOGLE_MASTER_EMAIL setting. If the
>   setting is empty nobody is treated as the club account.
> - When a grant is dropped when flamekeeping ends, the app does not
>   revoke it at Google if it belongs to the club account, so the
>   master login cannot be cut off by accident.
> - Messages. Start: "The club account owns the album folders and
>   cannot be a flamekeeper." Ban: "The club account owns every
>   album folder and cannot be banned."
> - The ban refusal is part of the admin ban flow, see
>   ../admin/ban-member.md for the dialog itself.
> - The Google return check only happens after Google has handed
>   back tokens, so a failed token exchange shows the token error
>   first.
> - Non-members are never sent to onboarding, so the club account
>   is not sent to any sign-up page.
> - Normal connection steps are in connect-drive.md and
>   drive-callback.md.

```mermaid
sequenceDiagram
    autonumber
    actor M as Club account
    participant Browser
    participant Worker
    participant D1
    participant GO as Google OAuth
    M->>Browser: Press Connect Drive
    Browser->>Worker: startDriveConnectFn(mode signup)
    Worker-->>Browser: error "The club account owns the album<br/>folders and cannot be a flamekeeper."
    Note over M,GO: Suppose the person gets to Google anyway
    GO->>Worker: GET /api/flamekeeper/callback
    Worker-->>Browser: Redirect with fk_error=master<br/>("The club account owns the album folders<br/>and cannot be a flamekeeper.")
    Note over Worker,D1: No flamekeeper row is written, so there is<br/>nothing to end
    Note over Worker,D1: Ban attempt by an admin
    Worker->>D1: read target email
    Worker-->>Browser: error "The club account owns every album<br/>folder and cannot be banned."
```
