# Signing in with Google

> **Question:** What happens when someone clicks "Continue with
> Google" on the login page, and how does a new account get made?
>
> **Answer:** The login page says that by logging in you agree to the
> Terms of Service and Privacy Policy, with links, and the button is
> always enabled. Google confirms who they are and they come back to
> `/login`, which sends them on to their home page. A brand-new
> account is only created for an @nu.edu.kz or @alumni.nu.edu.kz
> address. The time of acceptance (now) is saved in the new user row's
> terms_accepted_at as the account is created, and the
> account is finished at once: no Drive step, no other signup
> step. Any other new address is refused and sees a red message on the
> login page.
> Banned and inactive people are signed out again at once and see
> a red message too.
>
> **Notes:**
>
> - Only creating an account checks the email domain. Existing
>   accounts with any other domain can still sign in.
> - The home page is `/onboarding` for a member who has not
>   finished onboarding, else `/equipment` for members and
>   `/profile` for non-members. See access-gate.md for the rules.
> - The login page cannot tell new users from existing ones, so it
>   never blocks the button. Only account creation runs the check.
> - Nothing about the terms travels from the browser. A better-auth hook
>   stamps the acceptance time while creating the user. Existing accounts
>   are never asked again and never removed, and nothing deletes an account
>   for being unfinished.
> - A club member enters the club code later on `/profile`, see
>   join-club.md. An @nu.edu.kz user can become a flamekeeper from
>   the profile too, see flamekeepers/connect-drive.md.
> - Someone who is already signed in and opens `/login` is sent
>   straight to their home page.
> - If the Google sign-in call throws in the browser, the error
>   is only written to the browser console.
> - A refused new address is turned back by better-auth, and its
>   code in node_modules shows the redirect to
>   `/login?error=signup_domain_not_allowed`. No account row is written.
> - The Inactive check happens only at sign-in. When an admin sets
>   an account to Inactive, that person's sessions are deleted at
>   that moment. A ban is also checked on every page request, see
>   access-gate.md.
> - better-auth limits each client address to 3 requests per 10
>   seconds on its sign-in routes and 100 per 60 seconds on the
>   others. The sign-in page shows no message when that stops
>   a click.
> - The login page links to the About page, see about-page.md.
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
    W-->>B: No session, so the login page shows
    P->>B: Click Continue with Google
    B->>W: POST /api/auth/sign-in/social (provider google)
    W-->>B: Redirect to Google, account picker always shown
    B->>G: Person picks a Google account
    G->>W: GET /api/auth/callback/google with code
    alt New account and domain is not nu.edu.kz or alumni
        W-->>B: Redirect to /login with error<br/>signup_domain_not_allowed
        B-->>P: Red box: New accounts need an @nu.edu.kz or<br/>@alumni.nu.edu.kz Google account. Sign in with<br/>one of those.
    else Allowed
        W->>D: Create user with termsAcceptedAt = now and linked<br/>account if new, create session
        alt user.bannedAt is set
            W->>D: Delete all sessions of this user
            W-->>B: Redirect to /login/?error=banned
            B-->>P: Red box: This account has been banned from<br/>NU Image. Contact an administrator if you<br/>think this is a mistake.
        else status is Inactive
            W->>D: Delete all sessions of this user
            W-->>B: Redirect to /login/?error=account_inactive
            B-->>P: Red box: Your account has been deactivated.<br/>Please contact an administrator.
        else Active
            W-->>B: Session cookie, redirect to /login
            B->>W: getUserFn()
            W-->>B: User with member state
            B-->>P: Redirect to /onboarding, /equipment or<br/>/profile
        end
    end
```
