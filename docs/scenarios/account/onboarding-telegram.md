# Linking Telegram during onboarding

> **Question:** How does a new member finish onboarding by
> linking Telegram?
>
> **Answer:** The member clicks "Open Telegram Bot", which opens a
> chat with the bot using a one-time link. Pressing Start in
> Telegram links their chat to the account. The web page checks
> every 3 seconds and, once the link exists, marks onboarding
> complete and moves the member to `/equipment`.
>
> **Notes:**
> - The link token lasts 10 minutes. If an unexpired token
>   already exists for the member it is reused, so reloads do
>   not create new ones. Tokens are stored in telegram_link_token.
> - The page keeps checking until it succeeds. It does not fetch
>   a new token if the first one expires, and the bot then
>   answers "Link expired or invalid." unless the chat is already
>   linked.
> - The bot also sets onboardingComplete when it links the chat.
> - The bot side, including the replies, is in the telegram/
>   folder, see src/lib/telegram/commands/start.ts.
> - Failure to update the birthdays calendar is only logged.

```mermaid
sequenceDiagram
    autonumber
    participant P as New member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant T as Telegram
    Note over B,W: getTelegramLinkUrlFn already created the link,<br/>see onboarding-profile.md
    W->>D: Insert telegram_link_token, expires in 10 min
    P->>B: Click Open Telegram Bot
    B-->>P: New tab t.me link, button reads Waiting for<br/>Telegram...
    P->>T: Tap Start in the bot chat
    T->>W: /start token (webhook)
    Note over T,W: see telegram/ folder for the bot side
    W->>D: Set telegramChatId, telegramUsername,<br/>onboardingComplete, delete token
    W-->>T: Telegram linked ✅ and main menu
    loop Every 3 seconds until success
        B->>W: completeTelegramOnboardingFn(skipTelegram false)
        W->>D: Read user.telegramChatId
        alt Not linked yet
            W-->>B: Error Telegram not linked
            Note over B: Error is ignored and the page waits 3 s
        else Linked
            W->>D: Set user.onboardingComplete = true
            W->>W: reconcileBirthdaysToCalendar
            W-->>B: success
        end
    end
    B->>B: router.invalidate()
    B-->>P: Navigate to /equipment
```
