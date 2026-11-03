# Finishing signup with an NU Google account

> **Question:** What does a new @nu.edu.kz user have to do before
> they can use the app?
>
> **Answer:** They land on `/onboarding` and see "Lend some Drive
> storage". They must pledge between 1 and 1024 GB, give an
> expected graduation date in the future, accept the terms and
> then connect their Google Drive. Connecting Drive finishes the
> signup. They then arrive on `/profile` as a non-member and can
> browse albums and favorite photos.
>
> **Notes:**
> - The Google consent screen and the return trip are in
>   flamekeepers/connect-drive.md and flamekeepers/drive-callback.md.
> - The pledge box starts at 1 GB. A pledge above 1024 GB gets
>   the same message as one below 1 GB.
> - If the return trip fails, the person lands on `/onboarding`
>   with an error code in the address. A red message shows on the
>   form for these codes: denied, state, session, account, scope,
>   token and master.
> - Until Drive is connected, the account has no flamekeeper row,
>   so the access gate keeps sending them back here. Leaving the
>   page asks to delete the account, see leave-signup.md.
> - Accounts that never finish are also deleted by a scheduled
>   cleanup after 7 days, see
>   cron/albums-and-housekeeping/stale-signups.md.
> - Members who already have a club code skip this first step,
>   see join-club.md.

```mermaid
sequenceDiagram
    autonumber
    participant P as New NU user
    participant B as Browser
    participant W as Worker
    participant G as Google OAuth
    P->>B: Arrive on /onboarding after sign-in
    B->>W: getUserFn()
    W-->>B: Non-member without terms or flamekeeper row
    B-->>P: Lend some Drive storage form, pledge preset to 1 GB
    P->>B: Enter pledge, graduation date, tick terms, click<br/>Connect Drive
    alt Pledge below 1 GB or above 1024 GB
        B-->>P: Pledge at least 1 GB.
    else Graduation date not in the future
        B-->>P: Enter an expected graduation date in the future.
    else Terms not ticked
        B-->>P: Accept the terms to continue.
    else Form valid
        B-->>P: Button reads Redirecting to Google...
        B->>W: startDriveConnectFn(mode signup, pledgeGb,<br/>graduationDate, termsAccepted)
        alt Server refuses
            W-->>B: error message
            B-->>P: Shows the message, or Could not start Drive<br/>connection.
        else Accepted
            W-->>B: Google consent URL
            B->>G: Browser leaves the app for Google
            Note over B,G: see flamekeepers/connect-drive.md and<br/>flamekeepers/drive-callback.md
            G-->>B: Back through /api/flamekeeper/callback
            B-->>P: Lands on /profile as a non-member
        end
    end
```
