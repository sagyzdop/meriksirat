# Flamekeeper data

> **Question:** Which tables do the flamekeeper scenarios read and write?
>
> **Answer:** A flamekeeper has one row with pledge, usage and state, one saved Google refresh token, one folder (volume) per album it holds photos for, and temporary upload reservations while photos are in flight. Photos point at the flamekeeper that stores them. The cap lives in the global settings row.
>
> **Notes:**
> - KV key flamekeeper-oauth:nonce holds user id, pledged bytes,
>   graduation date and terms time as JSON, for 600 seconds. It is
>   deleted when read, see connect-drive.md and drive-callback.md.
> - R2 is not used by these scenarios.
> - Reservations expire 2 hours after they are made.
> - Used and pledged sizes are in bytes. The default cap is
>   21474836480 bytes (20 GB).
> - The access token cache lives in Worker memory for 50 minutes
>   and is not stored anywhere.

```mermaid
erDiagram
    user ||--o| flamekeeper : "can be"
    user ||--o| flamekeeper_grant : "has"
    user ||--o{ volume : "holds"
    user ||--o{ upload_reservation : "reserved for"
    album ||--o{ volume : "stored in"
    album ||--o{ photo : "contains"
    album ||--o{ upload_reservation : "for"
    user {
        text id PK
        text email "compared with the club account email"
        boolean isMember "is_member"
        text role "user, manager, admin"
        integer bannedAt "banned_at"
        text banReason "ban_reason"
    }
    flamekeeper {
        text userId PK "FK to user.id"
        integer pledgedBytes "pledged_bytes"
        integer usedBytes "used_bytes"
        integer driveUsageBytes "drive_usage_bytes"
        text state "active, full, draining, lost, drained"
        text graduationDate "graduation_date, YYYY-MM-DD"
        integer graduationConfirmedAt "graduation_confirmed_at"
        integer drainingDeadline "draining_deadline"
        text drainReason "opt_out, pledge, graduation, domain, ban"
        integer lostSince "lost_since"
        integer termsAcceptedAt "terms_accepted_at"
        integer createdAt "created_at"
    }
    flamekeeper_grant {
        text userId PK "FK to user.id"
        text refreshToken "refresh_token"
        text scopes "scopes"
        integer lastRefreshAt "last_refresh_at"
    }
    volume {
        text albumId PK "FK to album.id"
        text flamekeeperUserId PK "FK to user.id, flamekeeper_user_id"
        text driveFolderId "drive_folder_id"
        text permissionId "permission_id"
        integer droppedAt "dropped_at"
    }
    upload_reservation {
        text id PK
        text flamekeeperUserId FK "flamekeeper_user_id"
        text albumId FK "album_id"
        integer bytes "bytes"
        integer expiresAt "expires_at"
    }
    photo {
        text id PK
        text albumId FK "album_id"
        text driveFileId "drive_file_id"
        integer bytes "bytes"
        text flamekeeperUserId "flamekeeper_user_id"
        text state "live, moving, deleted, dropped"
    }
    album {
        text id PK
        text driveFolderId "drive_folder_id"
        text coverFileId "cover_file_id"
        integer deletedAt "deleted_at"
    }
    settings {
        text id PK "global"
        integer flamekeeperCapBytes "flamekeeper_cap_bytes"
    }
```
