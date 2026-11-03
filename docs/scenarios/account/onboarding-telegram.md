# Linking Telegram during onboarding

> **Question:** How does a new member finish onboarding by
> linking Telegram?
>
> **Answer:** The member clicks "Open Telegram Bot", which opens a
> chat with the bot using a one-time link. Tapping Start in
> Telegram links their chat to the account. After the click the
> web page asks the server every 3 seconds. Once the link exists
> it marks onboarding complete and moves the member to
> `/equipment`.
>
> **Notes:**
> - The link token lasts 10 minutes. If an unexpired token
>   already exists for the member it is reused, so reloads do
>   not create new ones. Tokens are stored in telegram_link_token.
> - The page only starts asking after the button is clicked. It
>   keeps asking until it succeeds. Any error is ignored, not
>   only "Telegram not linked". It never fetches a new token, so
>   once the first one expires the bot answers "Link expired or
>   invalid." unless the chat is already linked.
> - The bot also sets onboardingComplete when it links the chat.
> - The bot side, including the replies, is in
>   telegram/link-account.md. Where the link is created is in
>   telegram/link-token-create.md.
> - Failure to update the birthdays calendar is only logged.

```mermaid
sequenceDiagram
    autonumber
    participant P as New member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant T as Telegram
    Note over B,W: getTelegramLinkUrlFn already found or created<br/>the token, see onboarding-profile.md
    P->>B: Click Open Telegram Bot
    B-->>P: New tab with the t.me link, button reads<br/>Waiting for Telegram...
    P->>T: Tap Start in the bot chat
    T->>W: /start token (webhook)
    Note over T,W: see telegram/link-account.md for the bot side
    W->>D: Set telegramChatId, telegramUsername,<br/>onboardingComplete, delete token
    W-->>T: Telegram linked ✅ and main menu
    loop Every 3 seconds from the click until success
        B->>W: completeTelegramOnboardingFn(skipTelegram false)
        W->>D: Read user.telegramChatId
        alt Not linked yet or any other error
            W-->>B: Error, for example Telegram not linked
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
