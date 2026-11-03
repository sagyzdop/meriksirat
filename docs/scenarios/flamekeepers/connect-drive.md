# Sign up as a flamekeeper and connect a Drive

> **Question:** What happens when someone fills in the flamekeeper form and presses Connect Drive?
>
> **Answer:** The browser checks the pledge, the graduation date and the terms box, then asks the server to start the connection. The server refuses the club account and anyone who cannot sign up (not an @nu.edu.kz account, or already flamekeeping). Otherwise it remembers the pledge for 10 minutes under a random code and returns a Google consent link, and the browser goes to Google. The form is on the onboarding page for new @nu.edu.kz sign-ups and in the profile card for @nu.edu.kz accounts that are not flamekeeping.
>
> **Notes:**
> - The pledge is only stored in KV at this point. No flamekeeper
>   row exists until Google comes back, see drive-callback.md.
> - Pledge limits are 1 GB to 1024 GB. The date must be a real
>   calendar day after now (UTC midnight), so today is refused.
> - Reconnecting a lost flamekeeper uses the same function in
>   reconnect mode, see profile-card.md.
> - Google is asked for the drive.file, openid and email scopes,
>   with offline access and a forced consent screen. The sign-in
>   email is passed as a login hint.
> - Why the club account is refused is in master-account.md.
> - A drained flamekeeper sees the form behind a Become a
>   flamekeeper switch on the profile card.

```mermaid
sequenceDiagram
    autonumber
    actor P as Member or Guest
    participant Browser
    participant Worker
    participant D1
    participant KV
    participant GO as Google OAuth
    P->>Browser: Fill pledge, date, tick terms,<br/>press Connect Drive
    alt Pledge outside 1 to 1024 GB
        Browser-->>P: "Pledge at least 1 GB."
    else Date not a future day
        Browser-->>P: "Enter an expected graduation date<br/>in the future."
    else Terms box not ticked
        Browser-->>P: "Accept the terms to continue."
    else Form is valid
        Browser->>Worker: startDriveConnectFn(mode signup,<br/>pledgeGb, graduationDate, termsAccepted)
        alt Signed in as the club account
            Worker-->>Browser: error "The club account owns the<br/>album folders and cannot be a flamekeeper."
        else Not eligible for signup
            Worker->>D1: read access rules for the user
            Worker-->>Browser: error "Only @nu.edu.kz accounts that<br/>are not already flamekeepers can sign up."
        else Server re-check of pledge or date fails
            Worker-->>Browser: error "Invalid pledge" or "Expected<br/>graduation date must be in the future"
        else Accepted
            Worker->>KV: put flamekeeper-oauth:nonce = user,<br/>pledge bytes, date, terms time (TTL 600 s)
            Worker-->>Browser: Google consent url
            Browser->>GO: Redirect to the consent screen<br/>(button reads "Redirecting to Google...")
        end
        Browser-->>P: A server error shows in the red<br/>box on the form
    end
```
