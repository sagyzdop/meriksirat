# Flamekeeper data

> **Question:** Which tables do the flamekeeper scenarios read and write?
>
> **Answer:** A flamekeeper has one row with pledge, usage and state, one saved Google refresh token. Older code also gave it one folder (volume) per album; nothing creates those any more, and a volume row still names the flamekeeper whose Drive holds that album's older photos. There is no photo table and no upload reservation table (both removed in #25). The cap lives in the global settings row.
>
> **Notes:**
> - KV key flamekeeper-oauth:nonce holds user id, pledged bytes,
>   graduation date and terms time as JSON, for 600 seconds. It is
>   deleted when read, see connect-drive.md and drive-callback.md.
> - The expected graduation date is not on the flamekeeper row. It is
>   `user.graduation_date` (first day of the month), shared with the
>   member profile, see ../account/erd.md.
> - R2 is not used by these scenarios.
> - The flamekeeper and flamekeeper_grant rows are deleted with
>   the user.
> - The drain columns (deadline, reason, reminder stamps), health_cursor and leaderboard_anonymous were removed in #25. The drain tickets add back what they need.
> - Used and pledged sizes are in bytes. The default cap is
>   21474836480 bytes (20 GB).
> - The access token cache lives in Worker memory for 50 minutes
>   and is not stored anywhere.

```mermaid
erDiagram
    user ||--o| flamekeeper : "can be"
    user ||--o| flamekeeper_grant : "has"
    user ||--o{ volume : "holds"
    album ||--o{ volume : "stored in"
    user {
        text id PK
        text name "account name"
        text first_name "shown in admin list"
        text last_name "shown in admin list"
        text email "compared with the club account email"
        text image "avatar"
        integer is_member "0 or 1"
        text role "user, manager, admin"
        integer banned_at "set when banned"
        text ban_reason "shown on the Banned badge"
    }
    flamekeeper {
        text user_id PK "FK to user.id"
        integer pledged_bytes "pledge in bytes"
        integer used_bytes "bytes stored"
        integer drive_usage_bytes "whole Drive usage"
        text state "active, full, draining, lost, drained"
        integer graduation_confirmed_at "last confirmation"
        integer lost_since "set when Drive is lost"
        integer terms_accepted_at "terms time"
        integer created_at "signup time"
    }
    flamekeeper_grant {
        text user_id PK "FK to user.id"
        text refresh_token "Google refresh token"
        text scopes "granted scopes"
        integer last_refresh_at "last refresh"
    }
    volume {
        text album_id PK "FK to album.id"
        text flamekeeper_user_id PK "FK to user.id"
        text drive_folder_id "folder in the flamekeeper Drive"
        text permission_id "share permission"
        integer dropped_at "set when the folder is dropped"
    }
    album {
        text id PK
        text drive_folder_id "master Drive folder"
        text cover_file_id "cover photo file"
        integer deleted_at "set when deleted"
    }
    settings {
        text id PK "global"
        integer flamekeeper_cap_bytes "default 21474836480"
    }
```
