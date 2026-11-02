# Linking or relinking a Telegram account with /start

> **Question:** What happens when someone opens the bot with
> `/start`, with or without a link token?
>
> **Answer:** With a valid, unexpired token the bot saves the
> chat id and Telegram username on the member's account, marks
> onboarding complete, deletes the token, then replies "Telegram
> linked ✅" and shows the main menu. This also moves an already
> linked account to a new chat (relinking). A bad or expired
> token gets "Link expired or invalid.", unless the chat is already
> linked, in which case it just shows the menu. `/start` with no
> token shows the menu to linked chats and a welcome text to others.
>
> **Notes:**
> - The token is the word after `/start` (split on a space).
> - Linking sets `onboarding_complete` to true, so finishing the
>   link in Telegram completes the onboarding step.
> - Relinking from a new chat overwrites the old chat id. The old
>   chat then counts as unlinked.
> - The code does not check whether the chat is already linked to
>   a different account before saving.
> - A used token is gone, so tapping the same link twice from a
>   linked chat shows the menu instead of an error.
> - Token creation is in `link-token-create.md`.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Worker
    participant D1
    participant Telegram
    Member->>Worker: /start or /start TOKEN<br/>handleStart(ctx)
    alt no token given
        Worker->>D1: find user with telegram_chat_id = chat id
        alt chat is linked
            Worker->>Telegram: showMainMenu(ctx)
        else not linked
            Worker->>Telegram: "Welcome! Please use the link from<br/>the web app to connect your account."<br/>keyboard removed
        end
    else token given
        Worker->>D1: find telegram_link_token with this token<br/>and expires_at in the future
        alt token missing or expired
            Worker->>D1: find user with this chat id
            alt chat is linked
                Worker->>Telegram: showMainMenu(ctx)
            else not linked
                Worker->>Telegram: "Link expired or invalid."
            end
        else token valid
            Worker->>D1: set user.telegram_chat_id, telegram_username,<br/>onboarding_complete = true
            Worker->>D1: delete the used token
            Worker->>Telegram: "Telegram linked ✅" keyboard removed
            Worker->>Telegram: showMainMenu(ctx)
        end
    end
    opt any step throws
        Worker->>Telegram: "Error linking account. Please try again."
    end
```
