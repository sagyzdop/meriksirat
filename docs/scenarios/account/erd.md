# Account tables

> **Question:** Which tables do the account scenarios read and
> write?
>
> **Answer:** Sign-in, onboarding, profile and deletion work on
> the user table and its sign-in helpers (session and account).
> Telegram linking uses telegram_link_token, joining the club
> reads settings.club_code, and a flamekeeper row decides whether
> a non-member may delete the account. The terms date is written
> to user.terms_accepted_at when the account is created.
>
> **Notes:**
> - Deleting a user cascades to session, account, favorite,
>   telegram_link_token, flamekeeper and flamekeeper_grant. It
>   also removes the user's albums, album memberships, upload
>   reservations and flamekeeper volumes, which these scenarios
>   do not use.
> - KV: the key `flamekeeper-oauth:{random id}` holds the pledge,
>   graduation month and terms time while a flamekeeper is at
>   Google. It lasts 10 minutes and is deleted when the person
>   returns. See flamekeepers/connect-drive.md.
> - No R2 data is used by these scenarios.
> - Telegram link tokens are random 32-character ids that last
>   10 minutes.

```mermaid
erDiagram
    user ||--o{ session : has
    user ||--o{ account : has
    user ||--o{ telegram_link_token : gets
    user ||--o| flamekeeper : may_be
    user ||--o| flamekeeper_grant : may_have
    user ||--o{ favorite : saves
    user {
        text id PK
        text email
        text first_name
        text last_name
        text birthday
        integer wants_birthday_congratulation
        text instagram_username
        integer nu_id
        text major
        text graduation_date "YYYY-MM-01, month precision"
        text status "Active, Inactive, On Probation, Board, Ex-Board, Roommate, Ex-Roommate, Graduated"
        text role "user, manager, admin"
        integer is_member
        integer onboarding_complete
        integer terms_accepted_at
        integer flamekeeper_invitation_dismissed_at
        integer banned_at
        text telegram_chat_id
        text telegram_username
    }
    session {
        text id PK
        text user_id FK
        text token
        integer expires_at
    }
    account {
        text id PK
        text user_id FK
        text provider_id
        text account_id
    }
    telegram_link_token {
        text token PK
        text user_id FK
        integer expires_at
    }
    flamekeeper {
        text user_id PK
        text state "active, full, draining, lost, drained"
    }
    flamekeeper_grant {
        text user_id PK
    }
    favorite {
        text user_id PK
        text photo_id PK
    }
    settings {
        text id PK "global"
        text club_code
    }
```
