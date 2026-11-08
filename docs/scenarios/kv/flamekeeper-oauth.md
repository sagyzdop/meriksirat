# KV: flamekeeper-oauth

Key `flamekeeper-oauth:{nonce}`. The nonce is a random UUID.

How does the Drive connect flow keep its state across the Google redirect?

```mermaid
sequenceDiagram
    participant U as User
    participant S as Server function
    participant K as KV
    participant G as Google
    participant C as /api/flamekeeper/callback
    U->>S: Connect Drive
    S->>K: put nonce -> pending connect, TTL 10 min
    S-->>U: Google auth URL with state=nonce
    U->>G: Consent
    G->>C: redirect with code and state
    C->>K: get nonce, then delete it
    C->>C: check pending.userId equals session user
    C->>G: exchange code for tokens
```

- Value: JSON `PendingConnect` with `userId`, `pledgedBytes`, `graduationDate`, `termsAcceptedAt`. For a Lost flamekeeper reconnecting it is built from the existing `flamekeeper` row.
- TTL: 600 s.
- Writer: `src/lib/flamekeeper/functions.ts` (start of connect). Reader and deleter: `src/routes/api/flamekeeper.callback.ts`.
- Why: it carries the pledge and terms acceptance through the redirect without trusting the browser, makes the `state` unguessable, and is single-use because the callback deletes it on first read. A missing or expired key sends the user back to `/become-flamekeeper` with a state error.
