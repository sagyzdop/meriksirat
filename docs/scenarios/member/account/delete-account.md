# Delete account

## Who can delete their account, and what happens?

```mermaid
sequenceDiagram
    autonumber
    participant P as Non-member
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Open /account
    opt Not a member and not flamekeeping
        B-->>P: "Delete my account" row in the Club section
        P->>B: Click Delete, confirm "Delete your account?"
        B->>W: deleteMyAccountFn()
        W->>D: Re-check the access rules
        alt Member or still flamekeeping
            W-->>B: Error, toast with the message
        else Allowed
            W->>D: Delete the user row (cascades)
            B-->>P: Load /, which redirects to /albums
        end
    end
```

- Club members cannot delete their account. Membership is permanent ([GLOSSARY](../../../../GLOSSARY.md)).
- A flamekeeper whose flamekeeping has stopped counts as not flamekeeping and may delete. Any other flamekeeper state blocks it.
- The cascade removes sessions, linked Google accounts, Telegram tokens, favorites and the flamekeeper row.
- Nothing else deletes accounts. Unfinished sign-ups are never removed.
