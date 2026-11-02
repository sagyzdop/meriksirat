# Account tables

> **Question:** Which tables do the account scenarios read and
> write?
>
> **Answer:** Sign-in, onboarding, profile and deletion work on
> the user table and its sign-in helpers (session and account).
> Telegram linking uses telegram_link_token, joining the club
> reads settings.clubCode, and a flamekeeper row decides whether
> a non-member has finished signup or may delete the account.
>
> **Notes:**
> - Deleting a user cascades to session, account, favorite,
>   telegram_link_token and flamekeeper.
> - No KV or R2 data is used by these scenarios.
> - Telegram link tokens are random 32-character ids that last
>   10 minutes.

```mermaid
erDiagram
    user ||--o{ session : has
    user ||--o{ account : has
    user ||--o{ telegram_link_token : gets
    user ||--o| flamekeeper : may_be
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
        integer graduation_year
        text status "Active, Inactive, On Probation, Board, Ex-Board, Roommate, Ex-Roommate, Graduated"
        text role "user, manager, admin"
        integer is_member
        integer onboarding_complete
        integer terms_accepted_at
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
    settings {
        text id PK "global"
        text club_code
    }
```
