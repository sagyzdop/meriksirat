# Sign-in, Onboarding and Profile

How a person signs in with Google, finishes signing up (NU accounts by lending Drive space, alumni by accepting terms, club members by entering the club code and filling in their details), links Telegram, and edits their own profile. Triggered by the person in the browser, plus the 5-minute cron that removes abandoned signups.

## Data

KV holds `flamekeeper-oauth:{nonce}` for 600 seconds (the pending Drive pledge, written when the person starts connecting Drive). Telegram link tokens live in D1, not KV.

```mermaid
erDiagram
  user ||--o{ session : has
  user ||--o{ account : has
  user ||--o| flamekeeper : "may lend Drive"
  user ||--o| flamekeeper_grant : "Drive token"
  user ||--o{ telegram_link_token : "link tokens"

  user {
    text id PK
    text email "unique, new accounts must end in nu.edu.kz or alumni.nu.edu.kz"
    text name
    text image
    text telegram_chat_id
    text telegram_username
    text first_name
    text last_name
    text birthday "date only text"
    integer wants_birthday_congratulation
    text instagram_username
    integer nu_id "unique"
    text major
    integer graduation_year
    text status "Active, Inactive, On Probation, Board, Ex-Board, Roommate, Ex-Roommate, Graduated"
    text role "user, manager, admin"
    integer is_member "false until club code accepted"
    integer onboarding_complete
    integer terms_accepted_at
    integer banned_at
    integer created_at
    integer updated_at
  }

  session {
    text id PK
    text token
    integer expires_at
    text user_id FK
  }

  account {
    text id PK
    text provider_id
    text account_id
    text user_id FK
  }

  flamekeeper {
    text user_id PK "FK to user"
    integer pledged_bytes
    text state "active, full, draining, lost, drained"
    text graduation_date
    integer terms_accepted_at
  }

  flamekeeper_grant {
    text user_id PK "FK to user"
    text refresh_token
    text scopes
  }

  telegram_link_token {
    text token PK
    text user_id FK
    integer expires_at "10 minutes after creation"
  }

  settings {
    text id PK "always global"
    text club_code "8 characters as XXXX-XXXX"
  }
```

## Signing in with Google

A visitor opens the login page and taps Continue with Google. Better Auth allows 100 requests per 60 seconds on the auth routes. Brand new accounts must use an NU or alumni address. Existing accounts of any address can still sign in.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Visitor
  participant Browser
  participant Worker
  participant Google as Google OAuth
  participant D1

  Person->>Browser: open /login
  Browser->>Worker: getUserFn()
  Worker->>D1: resolve session from cookie
  alt already signed in
    Worker-->>Browser: user
    Browser->>Browser: redirect to homePath: /onboarding, /equipment or /profile
  else no session
    Worker-->>Browser: null, login page shown
    Note over Browser: Text says new accounts need an @nu.edu.kz or @alumni.nu.edu.kz Google account
  end
  Person->>Browser: tap Continue with Google
  Browser->>Worker: POST /api/auth/ sign-in social, callbackURL /equipment, errorCallbackURL /login
  Worker-->>Browser: Google consent URL with prompt select_account
  Browser->>Google: person picks a Google account
  Google-->>Browser: redirect to /api/auth/ callback with code
  Browser->>Worker: GET /api/auth/ callback google
  Worker->>Google: exchange code, read profile
  alt new email and domain is not nu.edu.kz or alumni.nu.edu.kz
    Worker-->>Browser: user create refused, redirect to /login with error signup_domain_not_allowed
    Note over Browser: Red box: New accounts need an @nu.edu.kz or @alumni.nu.edu.kz Google account. Sign in with one of those.
  else sign-in allowed
    Worker->>D1: create user and account if new, create session
    Worker->>D1: read user.status and banned_at
    alt banned_at is set
      Worker->>D1: delete all sessions of the user
      Worker-->>Browser: redirect to /login/ with error banned
      Note over Browser: Red box: This account has been banned from MerikSirat. Contact an administrator if you think this is a mistake.
    else status is Inactive
      Worker->>D1: delete all sessions of the user
      Worker-->>Browser: redirect to /login/ with error account_inactive
      Note over Browser: Red box: Your account has been deactivated. Please contact an administrator.
    else active
      Worker-->>Browser: session cookie, redirect to /equipment
      Note over Browser: The guard in the next scenario decides where the person really lands
    end
  end
  opt starting sign-in throws in the browser
    Browser->>Browser: only a console error Sign in failed, nothing shown
  end
```

## Entering the app: guard, session and sign-out

Every page under the signed-in area runs the same check before it loads. This diagram also covers the helpers that read the session.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Signed-in person
  participant Browser
  participant Worker
  participant D1

  Person->>Browser: open any signed-in page, for example /equipment
  Browser->>Worker: getUserFn() in the _authenticated guard
  Worker->>Worker: resolveSession(headers), cached for the one request
  Worker->>D1: read session and user through Better Auth
  Worker->>D1: read user.banned_at
  opt banned_at is set
    Worker->>D1: delete all sessions of the user
    Worker-->>Browser: null, as if signed out
  end
  opt session user lacks onboarding_complete or is_member
    Worker->>D1: read the fresh user row and flamekeeper.state
  end
  Worker->>Worker: isMaster = email equals GOOGLE_MASTER_EMAIL
  Worker-->>Browser: user profile or null
  alt no user
    Browser->>Browser: redirect to /login
  else needsOnboarding is true
    Note over Browser: Member without onboarding_complete, OR non-member with no flamekeeper row and no terms_accepted_at. The master account is never sent to onboarding.
    Browser->>Browser: redirect to /onboarding
  else not a member and path is not /profile or /favorites
    Browser->>Browser: redirect to /profile
  else allowed
    Browser->>Browser: page loads inside the shell
  end
  Note over Worker,D1: getSessionFn() returns the session or null. requireAuthenticatedUser() throws Not authenticated. Server code uses them directly, no screen calls getSessionFn.
  Person->>Browser: tap Log out in the sidebar
  Browser->>Worker: POST /api/auth/ sign-out (authClient.signOut)
  Worker->>D1: delete the session
  Browser->>Browser: invalidate router, go to /login
```

## Creating an account (NU Drive pledge, alumni terms, leaving)

A new person lands on /onboarding. The route sends a signed-out visitor to /login and an already finished person to their home path. A member sees the profile step instead (see the next scenario). While on this first step, leaving the page means the new account is deleted.

```mermaid
sequenceDiagram
  autonumber
  participant Person as New person
  participant Browser
  participant Worker
  participant D1
  participant KV
  participant Google as Google OAuth

  Person->>Browser: open /onboarding (non-member)
  Browser->>Worker: getUserFn()
  Worker-->>Browser: user
  alt email ends in nu.edu.kz
    Note over Browser: Card Lend some Drive storage. Pledge at least 1 GB, then connect Drive.
    Person->>Browser: fill pledge (default 1 GB), graduation date, tick terms, tap Connect Drive
    alt pledge under 1 GB or over 1024 GB
      Browser-->>Person: Pledge at least 1 GB.
    else graduation date missing, malformed or not in the future
      Browser-->>Person: Enter an expected graduation date in the future.
    else terms not ticked
      Browser-->>Person: Accept the terms to continue.
    else form valid
      Browser->>Worker: startDriveConnectFn(mode signup, pledgeGb, graduationDate, termsAccepted)
      Note over Worker,KV: see 07-flamekeepers.md for the full Drive grant. In short:
      Worker->>D1: loadAccessRules: canBecomeFlamekeeper needs nu.edu.kz email and no active flamekeeper row
      alt master account or rule fails or bad pledge
        Worker-->>Browser: error text shown in the red box
      else ok
        Worker->>KV: put flamekeeper-oauth:nonce with pledge and terms time, TTL 600 s
        Worker-->>Browser: Google consent URL
        Browser->>Browser: mark finishing, go to Google, button says Redirecting to Google...
        Browser->>Google: person allows access to files the app creates
        Google-->>Browser: redirect to /api/flamekeeper/callback with code and state
        Browser->>Worker: GET /api/flamekeeper/callback
        Worker->>KV: get and delete flamekeeper-oauth:nonce
        alt failure code
          Worker-->>Browser: redirect to /onboarding with fk_error (non-members) or /profile (members and flamekeepers)
          Note over Browser: state: The connection request expired. Please start again.<br/>session: Your session changed during the connection. Please start again.<br/>denied: Google access was not granted. You can try again.<br/>token: Google did not return a usable authorization. Please try again.<br/>master: The club account owns the album folders and cannot be a flamekeeper.<br/>account: Connect Drive with the same @nu.edu.kz Google account you signed in with.<br/>scope: The Drive permission was not granted. Please allow file access.
        else success
          Worker->>D1: upsert flamekeeper (state active) and flamekeeper_grant in one batch
          Worker-->>Browser: redirect to /profile?flamekeeper=connected
          Note over Browser: Person now has a flamekeeper row, so onboarding is finished. They are not a member yet.
        end
      end
    end
  else email ends in alumni.nu.edu.kz
    Note over Browser: Card Create your account. Too little Drive storage, can browse albums and favorite photos.
    Person->>Browser: tick terms, tap Create account
    Browser->>Worker: acceptSignupTermsFn(accepted true)
    alt not signed in
      Worker-->>Browser: Unauthorized
    else email is NU
      Worker-->>Browser: NU accounts finish signup by connecting Drive
    else ok
      Worker->>D1: set user.terms_accepted_at = now
      Worker-->>Browser: success
      Browser->>Browser: invalidate router, go to /profile
    end
    opt the call fails
      Browser-->>Person: Could not create the account. Please try again.
    end
  end
  opt person tries to leave /onboarding while on this first step
    Browser-->>Person: dialog Leave signup? Your account will be deleted
    alt tap Stay
      Browser->>Browser: stay on the page
    else tap Delete account and leave
      Browser->>Worker: deleteOnboardingAccountFn(confirm true)
      Worker->>D1: check is_member, terms_accepted_at and flamekeeper row
      alt any of them set
        Worker-->>Browser: Account has already finished signup
        Browser-->>Person: Could not delete the account. Please close this page.
      else clean
        Worker->>D1: delete user (sessions, accounts, Telegram tokens cascade)
        Browser->>Browser: navigation continues, button said Deleting account...
      end
    end
  end
```

## Joining the club and finishing the member profile

A non-member (Drive lender or alumni) opens their profile, enters the club code, then completes name, NU ID and other details, accepts the terms dialog and links Telegram. The club code is one row in `settings` and is created on first use if missing.

```mermaid
sequenceDiagram
  autonumber
  participant Person as Non-member
  participant Browser
  participant Worker
  participant D1
  participant Telegram

  Person->>Browser: open /profile, card Join the club
  Person->>Browser: type club code, tap Continue
  Note over Browser: Continue is disabled when the box is empty. Button says Checking... while waiting.
  Browser->>Worker: submitClubCodeFn(code, 1 to 64 characters)
  alt not signed in
    Worker-->>Browser: Unauthorized
  else signed in
    Worker->>D1: read settings.club_code (global), create a new XXXX-XXXX code if none
    Note over Worker: Match ignores case and surrounding spaces
    alt code wrong
      Worker-->>Browser: success false
      Browser-->>Person: That code is not correct. Check it and try again.
    else code right
      Worker->>D1: set user.is_member = true
      Worker-->>Browser: success true
      Browser->>Browser: invalidate router, go to /onboarding
    end
  end
  opt the call throws
    Browser-->>Person: Could not check the code. Please try again.
  end

  Person->>Browser: /onboarding now shows Complete Your Profile
  Person->>Browser: fill first name, last name, birthday, NU ID, major, graduation year, Instagram, birthday wish checkbox
  alt a required field is empty
    Browser-->>Person: field message such as First name is required, checked on blur
  else valid
    Browser-->>Person: dialog Terms of Service
    alt tap Cancel
      Browser->>Browser: close dialog, nothing saved
    else tap I Agree
      Browser->>Worker: updateUserOnboardingFn(profile fields, nuId and graduationYear as numbers)
      Worker->>D1: loadAccessRules: canBook needs is_member
      alt not a member or server error or invalid numbers
        Worker-->>Browser: error such as Club membership is required
        Browser-->>Person: Failed to save profile information. Please try again.
      else saved
        Worker->>D1: update name, birthday, wants_birthday_congratulation, instagram, nu_id, major, graduation_year
        Worker-->>Browser: needsTelegramLink true
        Browser->>Worker: getTelegramLinkUrlFn()
        Worker->>D1: read user.telegram_chat_id
        alt development mode (DEV true)
          Worker-->>Browser: isDevelopment true
          Browser->>Worker: completeTelegramOnboardingFn(skipTelegram true)
          Worker->>D1: set user.onboarding_complete = true
          Browser->>Browser: invalidate router, go to /equipment
        else Telegram already linked
          Worker-->>Browser: alreadyLinked true
          Browser->>Worker: completeTelegramOnboardingFn(skipTelegram false)
          Worker->>D1: set user.onboarding_complete = true
          Browser->>Browser: invalidate router, go to /equipment
        else not linked
          Worker->>D1: reuse an unexpired telegram_link_token or insert one, valid 10 minutes
          Worker-->>Browser: t.me bot link with start token
          Note over Browser: Card Step 2: Telegram Integration, button Open Telegram Bot
        end
      end
    end
  end

  Person->>Browser: tap Open Telegram Bot
  Browser->>Browser: open link in a new tab, button says Waiting for Telegram...
  Person->>Telegram: tap Start in the bot
  Telegram->>Worker: /start token (handleStart)
  Worker->>D1: find telegram_link_token not expired
  alt token invalid or expired
    alt this chat is already linked to a user
      Worker->>Telegram: main menu (see 04-telegram-bot.md)
    else not linked
      Worker->>Telegram: Link expired or invalid.
    end
  else valid
    Worker->>D1: set telegram_chat_id, telegram_username, onboarding_complete = true on the user
    Worker->>D1: delete the token
    Worker->>Telegram: Telegram linked ✅, then main menu
  end
  opt anything throws in handleStart
    Worker->>Telegram: Error linking account. Please try again.
  end
  opt bare /start with no token
    alt chat already linked
      Worker->>Telegram: main menu
    else not linked
      Worker->>Telegram: Welcome! Please use the link from the web app to connect your account.
    end
  end
  loop every 3 seconds after the link was opened
    Browser->>Worker: completeTelegramOnboardingFn(skipTelegram false)
    Worker->>D1: read user.telegram_chat_id
    alt not linked yet
      Worker-->>Browser: error Telegram not linked, silently retried
    else linked
      Worker->>D1: set onboarding_complete = true
      Worker->>Worker: reconcileBirthdaysToCalendar (see 05-admin-console.md), failure only logged
      Browser->>Browser: invalidate router, go to /equipment
    end
  end
```

## Editing your own profile

Members edit their details and re-link Telegram from /profile. Non-members can delete their account from the same page. The profile page loads the user with getUserFn and the flamekeeper record with getMyFlamekeeperFn. None of these actions invalidate a query key, they call router.invalidate().

```mermaid
sequenceDiagram
  autonumber
  participant Person as Member
  participant Browser
  participant Worker
  participant D1
  participant Telegram

  Person->>Browser: open /profile
  Browser->>Worker: getUserFn() and getMyFlamekeeperFn() (see 07-flamekeepers.md)
  Worker-->>Browser: user and flamekeeper
  Note over Browser: Tabs Editable Information and Admin Managed. A fk_error or flamekeeper=connected in the URL shows the Drive result.
  Person->>Browser: tap Edit Profile, change fields, tap Save Changes
  alt first or last name empty
    Browser-->>Person: First name is required or Last name is required
  else valid
    Browser->>Worker: updateUserProfileFn(only the filled fields, numbers for nuId and graduationYear)
    alt not signed in
      Worker-->>Browser: Unauthorized
      Browser-->>Person: toast Unauthorized
    else nothing to change
      Worker-->>Browser: No valid fields provided for update
      Browser-->>Person: toast with that message
    else saved
      Worker->>D1: update the user row, then read it back
      opt birthday was sent
        Worker->>Worker: reconcileBirthdaysToCalendar (see 05-admin-console.md), failure only logged
      end
      Worker-->>Browser: updated user
      Browser-->>Person: toast Profile updated successfully
      Browser->>Browser: leave edit mode, router.invalidate()
    end
    opt server error such as a duplicate NU ID
      Browser-->>Person: toast with the error message, or Failed to update profile
    end
  end
  Person->>Browser: tap Update Telegram
  Browser->>Worker: getTelegramUpdateLinkUrlFn()
  Worker->>D1: reuse an unexpired telegram_link_token or insert one, valid 10 minutes
  Worker-->>Browser: t.me bot link
  Browser->>Browser: open link in a new tab
  Browser-->>Person: toast Open Telegram and tap Start to update your linked username
  Person->>Telegram: tap Start
  Telegram->>Worker: /start token (handleStart, same as above)
  Worker->>D1: set telegram_chat_id and telegram_username
  Worker->>Telegram: Telegram linked ✅
  Note over Browser: The page shows the new username after the next reload
  opt link request fails
    Browser-->>Person: toast with the error, or Failed to open Telegram
  end

  Person->>Browser: non-member taps Delete my account
  Browser-->>Person: dialog Delete your account? This removes your account and your favorites. It cannot be undone.
  alt tap Cancel
    Browser->>Browser: close dialog
  else tap Delete account
    Browser->>Worker: deleteMyAccountFn() (see 07-flamekeepers.md)
    Worker->>D1: loadAccessRules, canDeleteAccount needs non-member and no active flamekeeping
    alt not allowed
      Worker-->>Browser: Club members keep their account. Other accounts can be deleted once any flamekeeping has stopped and the photos have moved.
      Browser-->>Person: toast with that message
    else allowed
      Worker->>D1: delete the user row
      Browser->>Browser: full reload to /
    end
  end
```

## Cleaning up abandoned signups

Every 5 minutes the cron removes accounts that signed in but never finished signing up.

```mermaid
sequenceDiagram
  autonumber
  participant Cron
  participant Worker
  participant D1

  Cron->>Worker: scheduled, last step cleanupStaleSignups (runStaleSignupCleanup)
  Worker->>D1: select users oldest first, up to 100 rows
  Note over Worker,D1: Filter: is_member false, not banned, email not alumni.nu.edu.kz, not the master email, created at least 7 days ago, no flamekeeper row, no flamekeeper_grant, no bookings, albums, album memberships, favorites, volumes or photos
  Worker->>Worker: selectStaleSignups keeps at most 20, oldest first
  alt none qualify
    Worker-->>Cron: nothing written
  else some qualify
    Worker->>D1: delete their sessions
    Worker->>D1: delete their accounts
    Worker->>D1: delete the users
    Worker->>Worker: log Deleted N unfinished signup(s)
  end
  opt anything throws
    Worker->>Worker: log Error in cleanupStaleSignups, cron continues
  end
```
