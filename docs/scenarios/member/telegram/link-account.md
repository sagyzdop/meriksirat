# Link a Telegram account

Related: [account](../account/), [bot routing](bot-routing.md).

## How does a member connect Telegram to their account?

The web app (onboarding step or Account page) asks for a link. The Worker makes `https://t.me/BOT?start=TOKEN`, reusing the member's unexpired token if one exists, otherwise storing a new 32 character token valid for 10 minutes. Tapping the link opens the bot and sends `/start TOKEN`.

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant T as Telegram
    M->>B: Open the Telegram step or Account page
    B->>W: getTelegramLinkUrlFn or getTelegramUpdateLinkUrlFn
    W->>D: Find unexpired telegram_link_token, or insert one (10 minutes)
    W-->>B: Link with the token
    M->>T: Tap the link, bot receives /start TOKEN
    T->>W: POST /api/telegram
    W->>D: Find the token with expires_at in the future
    alt Token missing or expired
        alt Chat already linked
            W->>T: Main menu
        else
            W->>T: "Link expired or invalid."
        end
    else Valid
        W->>D: Save telegram_chat_id and username, onboarding_complete = true, delete the token
        W->>T: "Telegram linked ✅", then the main menu
    end
```

- The onboarding call returns no link when the chat is already linked, and none when the server runs with `DEV=true`. The update call always returns a link.
- Linking again from a new chat overwrites the old chat id; the old chat then counts as unlinked. The code does not check whether the chat is linked to another account.
- Plain `/start` shows the main menu to a linked chat and "Welcome! Please use the link from the web app to connect your account." to others.
- Any error replies "Error linking account. Please try again."
- An unlinked chat gets "Please link your account via /start first." from every list command and button.
