# Club code

The club code is the secret a non-member enters to join the club. Admins see it on Settings, Members, and can rotate it; managers do not see the card.

## How does an admin view and rotate the code?

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant W as Worker
    participant D1
    A->>W: open /admin/settings/members
    W->>D1: read settings.clubCode (create one if missing)
    W-->>A: Club code card with Copy and Rotate
    A->>W: Rotate (rotateClubCodeFn)
    W->>D1: store a newly generated code
    W-->>A: new code shown, toast "Club code rotated"
```

- Rotating takes effect immediately and old codes stop working; there is no confirmation step and nobody is notified.
- Existing members are unaffected. Matching ignores case and surrounding spaces. How a user enters it: [member account docs](../../member/account/).
