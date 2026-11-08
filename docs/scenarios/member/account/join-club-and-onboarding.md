# Join the club and onboarding

## How does a non-member become a member?

```mermaid
sequenceDiagram
    autonumber
    participant P as Non-member
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Type the club code in "Join the club" on /account, click Join
    B->>W: submitClubCodeFn(code)
    W->>D: Read the current code from settings
    alt Code differs (case and edge spaces ignored)
        W-->>B: success false
        B-->>P: "That code is not correct. Check it and try again."
    else Code matches
        W->>D: Set isMember = true
        B->>B: Refresh the user, needsOnboarding is now true
        B-->>P: Navigate to /onboarding
    end
```

- The code lives in the global settings row and is managed by admins. If none exists yet, the first check creates a random one, so that first attempt fails.
- Joining does not touch an existing flamekeeper record ([ADR-0011](../../../adr/0011-membership-and-flamekeeping-are-separate.md)).

## How does a new member finish onboarding?

```mermaid
sequenceDiagram
    autonumber
    participant P as New member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant T as Telegram
    P->>B: Fill the profile form, click Complete Onboarding
    B->>W: updateUserOnboardingFn(profile)
    W->>D: Save name, birthday, NU ID, major, graduation month, Instagram
    B->>W: getTelegramLinkUrlFn()
    alt DEV=true or Telegram already linked
        B->>W: completeTelegramOnboardingFn
        W->>D: onboardingComplete = true
        B-->>P: Navigate to /equipment
    else Not linked
        W-->>B: One-time bot link
        B-->>P: Step 2, "Open Telegram Bot"
        P->>T: Tap Start in the bot
        T->>W: /start token, bot links the chat
        loop Every 3 s after the click
            B->>W: completeTelegramOnboardingFn
            W->>D: Fail until telegramChatId exists, then onboardingComplete = true
        end
        B-->>P: Navigate to /equipment
    end
```

- Required: first name, last name, birthday, NU ID (positive whole number), major, graduation month. Instagram is optional and the birthday greeting box starts ticked. Terms were accepted at sign-in, so onboarding asks nothing about them.
- Any save failure shows "Failed to save profile information. Please try again." Examples: an NU ID already used by another account, or a graduation month a flamekeeper cannot have.
- Saving the form does not complete onboarding. Linking Telegram does. The bot also sets `onboardingComplete` when it links the chat. Finishing refreshes the birthdays calendar, and a failure there is only logged.
- Polling starts at the click, ignores every error and never fetches a new token. After the 10 minute token expires the bot answers "Link expired or invalid", unless the chat is already linked.
- Until onboarding is complete the member is redirected to `/onboarding` from every signed-in page, see [access gate](../../anon/access-gate.md).
