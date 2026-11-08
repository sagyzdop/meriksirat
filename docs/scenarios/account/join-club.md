# Becoming a member with the club code

> **Question:** How does a non-member become a club member?
>
> **Answer:** On `/account` they type the current club code in the "Join the
> club" row of the Club section and click Join. If it matches, the account becomes a member
> and the app moves them to `/onboarding` to fill in their
> profile. A wrong code shows an error and nothing changes.
>
> **Notes:**
>
> - The code is compared ignoring capital letters and spaces at
>   the ends. It is stored in the global settings row. The server
>   accepts at most 64 characters.
> - If no code exists yet, the first check creates a random one
>   and saves it, so that first attempt fails.
> - The pledge and photos of a flamekeeper stay as they are.
> - The profile step and Telegram step that follow are in
>   onboarding-profile.md and onboarding-telegram.md.
> - Only non-members see this row. Deleting the account is
>   offered below it, see delete-account.md.

```mermaid
sequenceDiagram
    autonumber
    participant P as Non-member
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Open /account, type the code in the Join the club row,<br/>click Join
    Note over B: Join is disabled while the box is empty
    B->>W: submitClubCodeFn(code)
    W->>D: Read settings.clubCode (create one if missing)
    alt Not signed in or server error
        W-->>B: error
        B-->>P: Could not check the code. Please try again.
    else Code does not match
        W-->>B: success false
        B-->>P: That code is not correct. Check it and try again.
    else Code matches
        W->>D: Set user.isMember = true
        W-->>B: success true
        B->>B: router.invalidate()
        B->>W: getUserFn()
        W-->>B: Member with onboardingComplete false
        B-->>P: Navigate to /onboarding, profile step, see<br/>onboarding-profile.md
    end
```
