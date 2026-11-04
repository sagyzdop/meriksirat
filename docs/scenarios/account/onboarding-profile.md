# Member profile step of onboarding

> **Question:** What happens when a new member fills in their
> profile on `/onboarding`?
>
> **Answer:** The member fills in name, birthday, NU ID, major
> and graduation year and clicks "Complete Onboarding". The
> details are saved and the app looks at Telegram. In local development with
> DEV=true, or if Telegram is already linked, onboarding finishes
> at once and the member goes to `/equipment`. Otherwise the
> Telegram step is shown.
>
> **Notes:**
> - Required in the form: first name, last name, birthday, NU ID,
>   major and graduation year. Instagram is optional. The
>   birthday greeting box starts ticked.
> - The server also requires a positive whole NU ID and a
>   graduation year from 2010 to 3000.
> - Saving the details does not mark onboarding complete. That
>   happens when Telegram is linked, or as drawn here when it is
>   already linked or skipped.
> - The terms were accepted on the login page and saved when the
>   account was created, see sign-in.md. Onboarding asks nothing
>   about terms.
> - Finishing also refreshes the birthdays calendar. A failure
>   there is only logged and does not stop the member.
> - Any failure on save shows the one message "Failed to
>   save profile information. Please try again." Examples are an
>   NU ID that another account already uses, a signed-out
>   session, or a refused membership check.
> - The Telegram step is in onboarding-telegram.md.

```mermaid
sequenceDiagram
    autonumber
    participant P as New member
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Fill in the form and click Complete Onboarding
    alt A required field is empty
        B-->>P: Inline error, for example First name is required
    else Valid
        B-->>P: Terms of Service pop-up
        alt Cancel
            P->>B: Click Cancel
            B-->>P: Pop-up closes, nothing is saved
        else I Agree
            P->>B: Click I Agree
            B->>W: updateUserOnboardingFn(profile fields)
            W->>D: Check user.isMember through the access rules
            alt Not a member or other failure
                W-->>B: Error, for example Club membership is<br/>required
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
                    W-->>B: Telegram deep link url, token reused or new
                    B-->>P: Step 2: Telegram Integration, see<br/>onboarding-telegram.md
                end
            end
        end
    end
```
