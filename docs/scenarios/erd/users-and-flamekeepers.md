# ERD: users and flamekeepers

Which tables hold accounts, sessions and flamekeepers? Source: `src/db/schema.ts`. Terms: [GLOSSARY.md](../../../GLOSSARY.md).

```mermaid
erDiagram
    user ||--o{ session : has
    user ||--o{ account : has
    user ||--o| flamekeeper : "may be"
    user ||--o| flamekeeper_grant : "holds"
    user {
        text id PK
        text email UK
        text role "user, manager, admin"
        text status "Active, Inactive, Alumni"
        bool isMember
        int clearanceLevel
        text graduationDate
        bool onboardingComplete
        ts bannedAt
        text banReason
        text bannedBy
        int cancelledInStartWindowCount
        int overdueCount
    }
    session {
        text id PK
        text userId FK
        ts expiresAt
    }
    account {
        text id PK
        text userId FK
        text providerId
    }
    flamekeeper {
        text userId PK, FK
        int pledgedBytes
        int usedBytes
        int driveUsageBytes
        text state "active, full, draining, lost, drained"
        ts lostSince
        ts lostNotifiedAt
        ts lostFinalizedAt
        ts healthCheckedAt
        ts graduationConfirmedAt
        ts graduationPromptSentAt
        ts termsAcceptedAt
    }
    flamekeeper_grant {
        text userId PK, FK
        text refreshToken
        text scopes
        ts lastRefreshAt
    }
```

- `flamekeeper.state` `drained` is shown as Stopped. Banned is not a state; it is `user.bannedAt` and overrides the shown status.
- Member status (`user.status`) is separate from flamekeeper state and from a ban ([ADR-0020](../../adr/0020-member-status-separate-from-flamekeeper-state-and-ban.md)).
- Deleting a user cascades to sessions, accounts, flamekeeper and grant.
- The grant (Drive refresh token) is dropped when flamekeeping ends. The `verification` table (auth tokens) is omitted.
