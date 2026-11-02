# Member profile step of onboarding

> **Question:** What happens when a new member fills in their
> profile on `/onboarding`?
>
> **Answer:** The member fills in name, birthday, NU ID, major
> and graduation year, then accepts the terms of service in a
> pop-up. The details are saved. The app then asks for a Telegram
> link. In local development with DEV=true, or if Telegram is
> already linked, onboarding finishes at once and the member goes
> to `/equipment`. Otherwise the Telegram step is shown.
>
> **Notes:**
> - Required in the form: first name, last name, birthday, NU ID,
>   major and graduation year. Instagram is optional. The
>   birthday greeting choice starts as yes.
> - The server also requires a positive whole NU ID and a
>   graduation year from 2010 to 3000.
> - Saving the details does not mark onboarding complete. That
>   happens in the Telegram step or, as drawn here, when it is
>   skipped.
> - Finishing also refreshes the birthdays calendar. A failure
>   there is only logged and does not stop the member.
> - The Telegram step is in onboarding-telegram.md.
> - Any failure while saving shows one generic message, for
>   example when the NU ID belongs to another account.

```mermaid
sequenceDiagram
    autonumber
    participant P as New member
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Fill in the form and click submit
    alt A required field is empty
        B-->>P: Inline error, for example First name is required
    else Valid
        B-->>P: Terms of Service pop-up
        P->>B: Click accept
        B->>W: updateUserOnboardingFn(profile fields)
        W->>D: Check user.isMember through the access rules
        alt Not a member
            W-->>B: Error Club membership is required
            B-->>P: Failed to save profile information. Please<br/>try again.
        else Member
            W->>D: Update name, birthday, nuId, major, year, etc.
            W-->>B: success, needsTelegramLink true
            B->>W: getTelegramLinkUrlFn()
            W->>D: Read user.telegramChatId
            alt DEV is true
                W-->>B: isDevelopment true
                B->>W: completeTelegramOnboardingFn(skipTelegram true)
                W->>D: Set user.onboardingComplete = true
                B-->>P: router.invalidate(), navigate to /equipment
            else Telegram already linked
                W-->>B: alreadyLinked true
                B->>W: completeTelegramOnboardingFn(skipTelegram false)
                W->>D: Set user.onboardingComplete = true
                B-->>P: router.invalidate(), navigate to /equipment
            else Not linked
                W-->>B: Telegram deep link url
                B-->>P: Step 2: Telegram Integration, see<br/>onboarding-telegram.md
            end
        end
    end
```
