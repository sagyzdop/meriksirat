# Finishing signup with an NU Google account

> **Question:** What does a new @nu.edu.kz user have to do before
> they can use the app?
>
> **Answer:** They land on `/onboarding` and see "Lend some Drive
> storage". They must pledge at least 1 GB, give an expected
> graduation date in the future, accept the terms and then connect
> their Google Drive. Connecting Drive is what finishes the signup.
> They then arrive on `/profile` as a non-member and can browse
> albums and favorite photos.
>
> **Notes:**
> - The Drive connection itself, the Google consent screen and
>   the return trip are in the flamekeepers folder, see
>   flamekeepers/ and src/routes/api/flamekeeper.callback.ts.
> - On failure the return trip lands on `/onboarding` with an
>   error code in the URL, shown above the form. Messages are for
>   denied, state, session, account, scope, token and master.
> - Until Drive is connected, the account has no terms date and no
>   flamekeeper record, so the access gate keeps sending them back
>   here. Leaving the page asks to delete the account, see
>   leave-signup.md.
> - Accounts that never finish are also deleted by a scheduled
>   cleanup, see cron/albums-and-housekeeping/.
> - Members who already have a club code skip this page's first
>   step, see join-club.md.

```mermaid
sequenceDiagram
    autonumber
    participant P as New NU user
    participant B as Browser
    participant W as Worker
    participant G as Google OAuth
    P->>B: Arrive on /onboarding after sign-in
    B->>W: getUserFn()
    W-->>B: Non-member without terms or flamekeeper record
    B-->>P: Lend some Drive storage form, pledge preset to 1 GB
    P->>B: Enter pledge, graduation date, tick terms, submit
    alt Pledge below 1 GB
        B-->>P: Pledge at least 1 GB.
    else Graduation date not in the future
        B-->>P: Enter an expected graduation date in the future.
    else Terms not ticked
        B-->>P: Accept the terms to continue.
    else Form valid
        B->>W: startDriveConnectFn(mode signup, pledgeGb,<br/>graduationDate, termsAccepted)
        alt Server refuses
            W-->>B: error message
            B-->>P: Shows the message, or Could not start Drive<br/>connection.
        else Accepted
            W-->>B: Google consent URL
            B->>G: Browser leaves the app for Google
            Note over B,G: see flamekeepers/ for consent and<br/>callback
            G-->>B: Back through the callback route
            B-->>P: Lands on /profile as a non-member
        end
    end
```
