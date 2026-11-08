# Connect Drive and OAuth callback

Sign-up and reconnect both end in a Google consent for the `drive.file` scope (plus `openid` and `email`), so the app only sees files it creates ([ADR-0013](../../../adr/0013-drive-grant-stored-apart-from-login.md)). The grant is stored apart from the login in `flamekeeper_grant`.

## How does the Drive connection start and finish?

```mermaid
sequenceDiagram
    autonumber
    actor U as Person
    participant W as Worker
    participant KV
    participant G as Google
    participant D1
    U->>W: startDriveConnectFn (signup with pledge and month, or reconnect)
    W->>W: check eligibility, refuse the master account
    W->>KV: flamekeeper-oauth:nonce = pledge, month, terms time (10 min)
    W-->>U: Google consent URL (offline access, login_hint = account email)
    U->>G: approve
    G->>W: GET /api/flamekeeper/callback?code&state
    W->>KV: read and delete the nonce
    W->>G: exchange code for tokens
    W->>W: run the checks below
    W->>D1: batch: set graduation date, upsert flamekeeper (Active), upsert grant
    W-->>U: redirect /account?flamekeeper=connected (toast "Drive connected")
```

The nonce is single use. Signup requires `canBecomeFlamekeeper`, a valid pledge option and a future graduation month. Reconnect requires state Lost and reuses the stored pledge.

## What makes the callback fail?

```mermaid
flowchart TD
    A["Callback"] --> B{"Signed in?"}
    B -- no --> L["Redirect /login"]
    B -- yes --> C{"Nonce found in KV?"}
    C -- no --> E1["state: request expired"]
    C -- yes --> D{"Nonce user = session user?"}
    D -- no --> E2["session: session changed"]
    D -- yes --> F{"Google returned a code?"}
    F -- no --> E3["denied"]
    F -- yes --> G{"Token exchange ok?"}
    G -- no --> E4["token"]
    G -- yes --> H{"Master account?"}
    H -- yes --> E5["master"]
    H -- no --> I{"Verified email equals sign-in email, @nu.edu.kz?"}
    I -- no --> E6["account"]
    I -- yes --> J{"drive.file granted and refresh token present?"}
    J -- no --> E7["scope or token"]
    J -- yes --> OK["Save and go to /account"]
```

Every error redirects to `/become-flamekeeper?fk_error=<code>`, which shows the message above the wizard. A reconnecting (Lost) flamekeeper is bounced on to `/account` with the same code, since they can no longer become one.

On a successful save the flamekeeper row is set Active and `lostSince`, `lostNotifiedAt` and `lostFinalizedAt` are cleared, so a reconnect brings a Lost flamekeeper back as if nothing happened. The row is created with `graduationConfirmedAt` set to now.
