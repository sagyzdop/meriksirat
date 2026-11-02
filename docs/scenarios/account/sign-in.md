# Signing in with Google

> **Question:** What happens when someone clicks "Continue with
> Google" on the login page?
>
> **Answer:** Google confirms who they are and they come back to
> `/login`, which then sends them to their home page. A brand-new
> account is only created for an @nu.edu.kz or @alumni.nu.edu.kz
> address. Banned and inactive users are signed out again at once
> and see a red message on the login page.
>
> **Notes:**
> - Only account creation checks the email domain. Existing
>   accounts with any other domain can still sign in.
> - The home page is `/onboarding` if signup is unfinished, else
>   `/equipment` for members and `/profile` for non-members.
>   See access-gate.md for the rules.
> - If Google sign-in fails in the browser, only the console
>   logs it. The person sees nothing new.
> - Sign-out is in sign-out.md.

```mermaid
sequenceDiagram
    autonumber
    participant P as Guest
    participant B as Browser
    participant W as Worker
    participant G as Google OAuth
    participant D as D1
    P->>B: Open /login
    B->>W: getUserFn()
    W-->>B: no session, login page shows
    P->>B: Click Continue with Google
    B->>W: POST /api/auth (better-auth sign-in, google)
    W-->>B: Redirect to Google, account picker always shown
    B->>G: Person picks a Google account
    G->>W: GET /api/auth callback with code
    alt New account and domain is not nu.edu.kz or alumni
        W-->>B: Redirect to /login with error<br/>signup_domain_not_allowed
        B-->>P: Red box: New accounts need an @nu.edu.kz or<br/>@alumni.nu.edu.kz Google account. Sign in with<br/>one of those.
    else Allowed
        W->>D: Create user if new, create session
        alt user.bannedAt is set
            W->>D: Delete all sessions of this user
            W-->>B: Redirect to /login/?error=banned
            B-->>P: Red box: This account has been banned from<br/>MerikSirat. Contact an administrator if you<br/>think this is a mistake.
        else status is Inactive
            W->>D: Delete all sessions of this user
            W-->>B: Redirect to /login/?error=account_inactive
            B-->>P: Red box: Your account has been deactivated.<br/>Please contact an administrator.
        else Active
            W-->>B: Session cookie, redirect to /login
            B->>W: getUserFn()
            W-->>B: User with member and signup state
            B-->>P: Redirect to homePath: /onboarding,<br/>/equipment or /profile
        end
    end
```
