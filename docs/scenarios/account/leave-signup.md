# Leaving signup before it is finished

> **Question:** What happens if a new user tries to leave the
> signup page without finishing?
>
> **Answer:** The app blocks the move and asks "Leave signup?".
> If the person chooses "Stay" nothing changes. If they choose
> "Delete account and leave", the unfinished account is deleted
> and they continue to where they were going. They can sign in
> with Google again later and start over.
>
> **Notes:**
> - Only the first signup step is guarded, for both NU and
>   alumni users. Members finishing their profile are never
>   deleted this way.
> - The server refuses to delete an account that is a member, has
>   accepted the terms, or has a flamekeeper row.
> - When the delete is refused or fails, the person stays on
>   `/onboarding`. Alumni users see "Could not delete the
>   account. Please close this page." in a red box. The NU form
>   does not show that message, so NU users see nothing.
> - Closing the tab shows the browser's own warning instead and
>   does not delete anything. Moving on to Google for the Drive
>   connection and finishing with "Create account" do not trigger
>   the prompt.
> - Sessions, linked Google accounts and Telegram link tokens are
>   removed together with the user row.

```mermaid
sequenceDiagram
    autonumber
    participant P as New user
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Click a link or the back button on /onboarding
    B-->>P: Dialog Leave signup? Your signup is not finished<br/>yet. If you leave now, your new account will be<br/>deleted and you can sign in again later to start<br/>over.
    alt Stay
        P->>B: Click Stay
        B-->>P: Navigation cancelled, still on /onboarding
    else Delete account and leave
        P->>B: Click Delete account and leave
        B-->>P: Button reads Deleting account...
        B->>W: deleteOnboardingAccountFn(confirm true)
        W->>D: Read user.isMember, termsAcceptedAt and<br/>the flamekeeper row
        alt Member, terms accepted or flamekeeper exists
            W-->>B: Error Account has already finished signup
            B-->>P: Alumni only: Could not delete the account.<br/>Please close this page. Stays on /onboarding
        else Qualifies
            W->>D: Delete the user row (cascades)
            W-->>B: success
            B-->>P: Navigation continues to the chosen page
        end
    end
```
