# Flamekeepers

A flamekeeper is someone who lends part of their NU Google Drive to hold club photos. This covers everything a person or admin triggers: signing up and rejoining, reconnecting Drive, editing the pledge, stopping, moving photos out through the browser, deleting an account, and the admin pages for the pool, free space and individual flamekeepers. The scheduled side (drain deadlines, reminders, bans, graduation, health checks, pool alerts) is in 09-cron-flamekeepers.md. Uploads are in 06-albums-and-uploads.md.

## Data

KV holds the sign-up handshake under `flamekeeper-oauth:{nonce}` with a 600 second TTL. The value is the pending user id, pledge, graduation date and terms time. An access token for a flamekeeper's Drive is also cached in Worker memory for 50 minutes per flamekeeper (not in KV).

```mermaid
erDiagram
  user ||--o| flamekeeper : "may be"
  user ||--o| flamekeeper_grant : "has"
  user ||--o{ volume : "hosts"
  user ||--o{ upload_reservation : "holds"
  album ||--o{ volume : "has"
  album ||--o{ photo : "contains"
  album ||--o{ upload_reservation : "receives"
  user {
    text id PK
    text email
    boolean is_member
    text role "user, manager, admin"
    integer banned_at
    text ban_reason
    text banned_by
  }
  flamekeeper {
    text user_id PK "FK to user.id"
    integer pledged_bytes
    integer used_bytes
    integer drive_usage_bytes
    text state "active, full, draining, lost, drained"
    text graduation_date
    integer graduation_confirmed_at
    integer draining_deadline
    text drain_reason "opt_out, pledge, graduation, domain, ban"
    integer drain_reminder_sent_at
    integer drain_admin_started_at
    integer drain_admin_reminded_at
    integer lost_since
    integer lost_notified_at
    integer lost_finalized_at
    integer health_checked_at
    integer terms_accepted_at
  }
  flamekeeper_grant {
    text user_id PK "FK to user.id"
    text refresh_token
    text scopes
    integer last_refresh_at
  }
  volume {
    text album_id PK "FK to album.id"
    text flamekeeper_user_id PK "FK to user.id"
    text permission_id
    text drive_folder_id
    integer release_blocked_at "last failed release"
    integer release_blocked_since "first failed release"
    integer release_alerted_at
    integer dropped_at
  }
  upload_reservation {
    text id PK
    text flamekeeper_user_id "FK to user.id"
    text album_id "FK to album.id"
    integer bytes
    integer expires_at "2 hours after creation"
  }
  photo {
    text id PK
    text album_id "FK to album.id"
    text drive_file_id
    integer bytes
    text flamekeeper_user_id
    text state "live, moving, deleted, dropped"
  }
  album {
    text id PK
    text title
    text drive_folder_id
    text cover_file_id
    integer expires_at
    integer expiry_reminder_30_sent_at
    integer expiry_reminder_7_sent_at
    boolean pinned
    integer deleted_at
  }
  settings {
    text id PK "global"
    integer flamekeeper_cap_bytes "default 20 GB"
  }
```

## Becoming a flamekeeper or reconnecting Drive

Sign-up happens on the onboarding page (NU emails only) or the profile page. Reconnecting is for a flamekeeper in state lost. Everything goes through Google consent and one callback route. The Drive scope asked for is `drive.file`, plus `openid` and `email`.

```mermaid
sequenceDiagram
  autonumber
  participant P as Flamekeeper candidate
  participant B as Browser
  participant W as Worker
  participant KV as KV
  participant G as Google OAuth
  participant D1 as D1
  P->>B: fills pledge GB, graduation date, ticks terms
  alt client check fails
    B-->>P: "Pledge at least 1 GB." or "Enter an expected graduation date in the future." or "Accept the terms to continue."
  end
  P->>B: clicks Connect Drive
  B->>W: startDriveConnectFn(mode signup, pledgeGb, graduationDate, termsAccepted)
  alt no session
    W-->>B: error "Unauthorized"
  else signed in as the master club account
    W-->>B: error "The club account owns the album folders and cannot be a flamekeeper."
  else GOOGLE_CLIENT_ID missing
    W-->>B: error "GOOGLE_CLIENT_ID not set"
  else not NU email or already flamekeeping (state not drained)
    W-->>B: error "Only @nu.edu.kz accounts that are not already flamekeepers can sign up."
  else pledge outside 1 to 1024 GB
    W-->>B: error "Invalid pledge" (the form validator gives "Pledge at least 1 GB" or "Pledge at most 1024 GB")
  else terms not true
    W-->>B: error "You must accept the flamekeeper terms"
  else graduation date not a real date in the future
    W-->>B: error "Expected graduation date must be in the future"
  end
  Note over B,W: Reconnect button on the profile card calls startDriveConnectFn(mode reconnect)
  alt reconnect but state is not lost
    W-->>B: error "Only a lost flamekeeper can reconnect Drive"
    B-->>P: toast with that message (or "Could not reconnect Drive")
  end
  W->>KV: put flamekeeper-oauth:nonce = user id, pledge, graduation date, terms time (TTL 600 s)
  W-->>B: Google consent URL (offline access, prompt consent, login_hint = account email)
  B->>G: browser navigates to Google consent
  G-->>B: redirect to /api/flamekeeper/callback with state and code
  B->>W: GET /api/flamekeeper/callback
  alt no session
    W-->>B: 302 to /login
  end
  Note over W: failure path is /profile for members and existing flamekeepers, else /onboarding
  W->>D1: read user.is_member and flamekeeper row to choose failure path
  W->>KV: get then delete flamekeeper-oauth:nonce
  alt nonce missing, expired or already used
    W-->>B: 302 failure path with fk_error=state
  else pending user differs from session user
    W-->>B: 302 failure path with fk_error=session
  else Google sent error or no code
    W-->>B: 302 failure path with fk_error=denied
  end
  W->>G: exchange code for tokens (token endpoint)
  alt exchange fails
    W-->>B: 302 failure path with fk_error=token
  end
  alt session email or Google email is the master account
    W-->>B: 302 failure path with fk_error=master
  else Google email not verified, differs from signed-in email, or not @nu.edu.kz
    W-->>B: 302 failure path with fk_error=account
  else drive.file scope not granted
    W-->>B: 302 failure path with fk_error=scope
  else no refresh token returned
    W-->>B: 302 failure path with fk_error=token
  end
  W->>D1: batch upsert flamekeeper (state active, deadline and lost fields cleared, health_checked_at now)
  W->>D1: batch upsert flamekeeper_grant (refresh_token, scopes, last_refresh_at)
  W->>W: forget cached access token for this user
  W-->>B: 302 to /profile with flamekeeper=connected
  B-->>P: profile card shows "Drive connected. Thank you for keeping the flame."
  Note over B,P: on failure the form or card shows the text for the code
```

Messages by code: denied "Google access was not granted. You can try again.", state "The connection request expired. Please start again.", session "Your session changed during the connection. Please start again.", account "Connect Drive with the same @nu.edu.kz Google account you signed in with.", scope "The Drive permission was not granted. Please allow file access.", token "Google did not return a usable authorization. Please try again.", master "The club account owns the album folders and cannot be a flamekeeper."

Rejoining after stopping works the same way: a drained flamekeeper sees "Become a flamekeeper" with a switch, fills the same form, and the callback upserts the old row back to active.

## Loading the profile and admin pages

The profile loader runs `getUserFn` and the flamekeeper query. The admin flamekeepers page, the dashboard pool card and the free-space panel load their lists. Opening the profile of a draining flamekeeper can also finish the drain.

```mermaid
sequenceDiagram
  autonumber
  participant P as Flamekeeper
  participant B as Browser
  participant W as Worker
  participant D1 as D1
  participant G as Google OAuth
  P->>B: opens /profile
  B->>W: getMyFlamekeeperFn()
  alt no session
    W-->>B: error "Unauthorized"
  end
  W->>D1: read flamekeeper row
  alt no row
    W-->>B: null (card offers Connect your Drive, or a message for non-NU accounts)
  end
  opt state is draining
    W->>W: finishDrainIfEmpty with a 20 subrequest budget
    W->>D1: check any live photo left in the person's volumes
    alt reason is pledge
      opt used_bytes at most pledged_bytes
        W->>D1: set state = active, clear drain fields
      end
    else no live photos left
      W->>D1: release empty volumes (see the volumes diagram)
      alt all volumes released and no unexpired reservation
        W->>D1: delete upload_reservation rows of this user
        W->>G: revoke refresh token (skipped for master account)
        W->>D1: delete flamekeeper_grant
        W->>D1: set state = drained, used_bytes 0, drive_usage_bytes 0, clear drain fields
      else something still blocks
        W->>D1: leave state draining
      end
    end
    Note over W: any error here is only logged and the old row is shown
    W->>D1: re-read flamekeeper row
  end
  W->>D1: count volumes of this user not dropped on albums not deleted
  W-->>B: state, pledge, used, graduation date, graduationConfirmDue (365 days since last confirm), deadline, drain reason, bytes left, lost since, albums hosted
  B-->>P: card with progress bar, state badge, and drain or lost banners
  Note over B,W: Admins load getAdminFlamekeepersFn, getPoolOverviewFn and getDeletionSuggestionsFn
  B->>W: getAdminFlamekeepersFn(search)
  alt not admin or manager
    W-->>B: error "Unauthorized: No session" or a permission error
  end
  W->>D1: flamekeepers joined to users, name or email or first or last name LIKE search, newest first, limit 500
  W-->>B: rows (the route loader only logs failures)
  B->>W: getPoolOverviewFn()
  W->>D1: read active and full flamekeepers with unexpired reservation sums, and settings.flamekeeper_cap_bytes
  W-->>B: pledged, used, free, flamekeeper count, cap bytes
  Note over B: red free figure when free space is under 10 percent
  B->>W: getDeletionSuggestionsFn() (admin role only)
  W->>D1: unpinned albums not deleted, non-favorited first, soonest expiry, then largest
  W-->>B: id, title, expiresAt, photoBytes, photoCount, favoriteCount
```

## Editing the pledge, confirming graduation, stopping

Edit pledge and Stop flamekeeping live on the profile card. Edit pledge is hidden when the drain reason is opt_out or domain. Stop is hidden when the state is lost or the reason is opt_out. A graduation date within 60 days of today starts a drain at once.

```mermaid
sequenceDiagram
  autonumber
  participant P as Flamekeeper
  participant B as Browser
  participant W as Worker
  participant D1 as D1
  participant Mail as Gmail (master account)
  P->>B: Edit pledge, changes GB and date, clicks Save
  alt pledge not 1 to 1024
    B-->>P: toast "Pledge at least 1 GB"
  end
  B->>W: updateFlamekeeperFn(pledgeGb, graduationDate)
  alt no session
    W-->>B: error "Unauthorized"
  else pledge invalid
    W-->>B: error "Invalid pledge"
  else no flamekeeper row
    W-->>B: error "You are not a flamekeeper"
  else state drained
    W-->>B: error "Sign up again to resume flamekeeping"
  else changed date not in the future
    W-->>B: error "Expected graduation date must be in the future"
  end
  W->>D1: changePledge: set pledged_bytes, graduation_date, graduation_confirmed_at = now
  alt date is 60 days or less away and active or full
    W->>D1: set state = draining, reason graduation, deadline now + 14 days (or drained at once if no photos)
  else pledge below used_bytes and active or full
    W->>D1: set state = draining, reason pledge, deadline now + 14 days
  else pledge raised above used while full
    W->>D1: set state = active
  else draining for pledge and pledge now covers used
    W->>D1: set state = active, clear drain fields
  else draining for graduation and date now more than 60 days away
    W->>D1: set state = active, clear drain fields
  end
  opt a drain started
    W->>Mail: email "we are moving your photos" with reason, GB left, deadline (Almaty date), link to /profile
  end
  W-->>B: success
  B->>B: invalidate query key flamekeepers, then router.invalidate
  B-->>P: toast "Flamekeeper settings updated", dialog closes (error toast shows the message, or "Update failed")
  P->>B: banner "Is DATE still your expected graduation date?" then Yes, it is right
  B->>W: confirmGraduationFn(no date)
  alt no session or no row
    W-->>B: error "Unauthorized" or "You are not a flamekeeper"
  end
  W->>D1: changePledge with same pledge and date, graduation_confirmed_at = now
  W-->>B: success
  B-->>P: toast "Graduation date confirmed" (error toast "Could not confirm the date" if no message)
  P->>B: Stop flamekeeping, confirms in dialog
  B->>W: optOutFlamekeeperFn()
  alt no session
    W-->>B: error "Unauthorized"
  else no row
    W-->>B: error "You are not a flamekeeper"
  else already drained
    W-->>B: error "You have already stopped flamekeeping"
  else state lost
    W-->>B: error "Reconnect Drive first so your photos can be moved"
  else already draining for opt_out or ban
    W-->>B: status unchanged
  end
  alt holds no live photos
    W->>W: finalize drained (release volumes, revoke Google grant, delete flamekeeper_grant)
    W->>D1: set state = drained, used_bytes 0
  else holds photos
    W->>D1: set state = draining, reason opt_out, deadline now + 14 days
    W->>Mail: email "we are moving your photos"
  end
  W-->>B: status (state, reason, deadline, bytes left)
  B-->>P: toast "You have stopped flamekeeping" or "Your photos are now moving to other flamekeepers"
  B->>B: invalidate query key flamekeepers, then router.invalidate
  Note over W: reminders, admin Telegram alerts and the 14 day deletion are cron, see 09-cron-flamekeepers.md
```

## Moving photos out through the browser

The Move photos now button appears in the draining banner on the flamekeeper's own profile, and for admins and managers as Move photos in the admin flamekeepers table. Each photo goes Drive to browser to Drive, one at a time. Admins pass the target `userId`, so the Worker uses the flamekeeper's token as the source.

```mermaid
sequenceDiagram
  autonumber
  participant P as Flamekeeper or Admin
  participant B as Browser
  participant W as Worker
  participant D1 as D1
  participant Src as Drive (source flamekeeper token)
  participant Dst as Drive (destination flamekeeper token)
  participant M as Drive (master token)
  P->>B: clicks Move photos now
  B->>B: warn before leaving the tab, show Pause button and progress
  loop until done, no space, paused or 3 failures in a row
    B->>W: startRelayFn(userId or empty)
    alt no session
      W-->>B: error "Unauthorized"
    else userId is someone else and caller is not admin or manager
      W-->>B: permission error
    end
    W->>W: finishDrainIfEmpty (20 subrequest budget)
    alt not draining any more
      W-->>B: kind done with status
    end
    W->>D1: pick a random live photo from up to 20 in the source volumes
    alt no photo left
      W-->>B: kind done with status
    end
    W->>W: get source access token (cache 50 min, else refresh with the grant)
    W->>D1: reserve space on another flamekeeper (not the source), 2 hour reservation
    W->>M: create or reuse the volume folder and share it with the destination flamekeeper
    W->>Dst: start resumable upload
    alt no other flamekeeper has room after 4 tries
      W-->>B: kind no_space "No other flamekeeper has room for these photos right now. Try again once more flamekeepers join."
      B-->>P: message shown, loop ends
    end
    W-->>B: kind photo with source file id, source token, upload URL, reservation id
    B->>Src: GET file bytes (source token)
    B->>Dst: PUT bytes to the upload URL
    alt download or upload fails
      B->>W: releaseRelayFn(userId, albumId, reservationId, quotaExceeded) fire and forget
      W->>D1: delete upload_reservation
      opt Google said storageQuotaExceeded (403)
        W->>D1: set destination state = full
      end
      B->>B: count one failure, wait 1 s times failures, try the next photo
    else upload ok
      B->>W: confirmRelayFn(userId, photoId, reservationId, fileId)
      alt reservation gone
        W-->>B: error "Move session expired, try again"
      else destination equals source
        W-->>B: error "Invalid move session"
      else album missing
        W-->>B: error "Album not found"
      end
      W->>Dst: read copy metadata
      alt copy not inside the destination volume folder
        W-->>B: error "Moved copy not found in the album folder"
      end
      alt photo changed meanwhile (not live, other album or other owner)
        W->>Dst: delete the unused copy
        W->>D1: delete upload_reservation
      else copy size differs from photo.bytes
        W->>Dst: delete the incomplete copy
        W->>D1: delete upload_reservation
        W-->>B: error "The moved copy was incomplete, try again"
      else another request moved it first
        W->>Dst: delete the unused copy
        W->>D1: delete upload_reservation
      else ok
        W->>D1: set photo.drive_file_id = new file, photo.flamekeeper_user_id = destination
        W->>D1: batch add bytes to destination used_bytes and drive_usage_bytes, delete reservation, move album cover if it pointed at the old file
        W->>Src: delete the old file (failure only logged, the file may stay in the source Drive)
        W->>D1: subtract bytes from source used_bytes and drive_usage_bytes
        W->>D1: release the source volume if it holds no photos for that album
        W->>W: clear cached album detail if present
      end
      W->>W: finishDrainIfEmpty again
      W-->>B: status (state, bytes left)
      B-->>P: "Moved NAME", progress and "N photos moved so far"
    end
  end
  alt status.state no longer draining or kind done
    B-->>P: "All photos have moved. Thank you!"
  else 3 failures in a row
    B-->>P: "Moving stopped: MESSAGE" or "Moving stopped after repeated errors"
  end
  B->>B: invalidate query key flamekeepers, then router.invalidate
```

## Volumes, grants and the 7 day rule during a request

Releasing a volume deletes the flamekeeper's subfolder in the album with the master token. It runs from the relay (one album at a time), from finishing a drain, and when an admin bans someone. Each call looks at up to 20 volumes.

```mermaid
sequenceDiagram
  autonumber
  participant W as Worker
  participant D1 as D1
  participant M as Drive (master token)
  participant F as Drive (flamekeeper token)
  participant G as Google OAuth
  W->>D1: pick volumes in scope with no non-deleted photo and no unexpired reservation
  Note over W,D1: skip volumes already alerted and blocked for 7 days or more
  loop each volume
    alt blocked within the last 6 hours
      W->>W: wait, leave for later
    else no drive folder id
      W->>D1: delete the volume row
    else folder exists
      W->>M: delete the volume folder
      alt deleted or already gone
        W->>D1: delete the volume row
      else Drive refuses because files in it are not the master's
        W->>F: list up to 50 files in the folder
        W->>D1: compare with photo rows not deleted
        opt files nobody references and volume still idle
          W->>F: batch delete those files
          W->>M: delete the folder again
          W->>D1: delete the volume row
        end
        Note over W: at most 3 such heals per call, each costs 3 subrequests
        opt still not released
          W->>D1: set release_blocked_at = now, release_blocked_since kept or set to now
        end
      end
    end
  end
  Note over W,D1: the request budget is 20 and the folder deletes draw from it, so some volumes wait for the next call
  Note over W,D1: after 7 days of failures the volume no longer blocks a finishing drain, and cron alerts admins, see 09-cron-flamekeepers.md
  W->>F: any Drive call with a flamekeeper token
  alt Drive says auth error and the token came from the cache
    W->>G: refresh the token once (needs 2 budget units), then retry the call
  end
  alt refresh answers invalid_grant (400 or 401)
    W->>W: grant error marked revoked, the caller skips that flamekeeper or fails
  else no grant row
    W->>W: grant error "No Drive grant"
  end
  Note over W: marking a flamekeeper lost is done by the health check, see 09-cron-flamekeepers.md
```

## Admin actions on a flamekeeper

An admin can move a draining flamekeeper's photos (see the moving photos diagram) and ban or unban them. Ban and Unban buttons show only for the admin role and never on the admin's own row. The ban dialog needs a reason.

```mermaid
sequenceDiagram
  autonumber
  participant A as Admin
  participant B as Browser
  participant W as Worker
  participant D1 as D1
  participant T as Telegram
  participant M as Drive (master token)
  A->>B: Ban on a row, types reason, clicks Ban user
  B->>W: banUserFn(userId, reason)
  alt caller not admin role
    W-->>B: permission error
  else target is the caller
    W-->>B: error "You cannot ban yourself"
  else reason blank
    W-->>B: error "Give a reason for the ban"
  else reason over 500 characters
    W-->>B: error "Keep the reason under 500 characters"
  else target missing
    W-->>B: error "User not found"
  else target is the master account
    W-->>B: error "The club account owns every album folder and cannot be banned."
  else already banned
    W-->>B: error "User is already banned"
  end
  W->>D1: set banned_at, ban_reason, banned_by on the user
  W->>D1: delete all session rows of the user
  alt target is active or full flamekeeper with photos
    W->>D1: set state = draining, reason ban, deadline now + 14 days
  else active or full with no photos
    W->>W: finalize drained (release volumes, revoke grant)
    W->>D1: set state = drained
  else already draining for another reason
    W->>D1: set reason ban, keep the earlier deadline if sooner
  else lost, drained or not a flamekeeper
    W->>D1: no flamekeeper change
  end
  W->>T: channel log that the user was banned, with actor and reason
  opt follow-up work
    W->>D1: cancel up to 3 booked bookings of banned users and log each cancel
    W->>M: release volumes of banned flamekeepers (up to 10) that hold no photos
    Note over W: any failure here is only logged and the 5 minute cron continues, see 09-cron-flamekeepers.md
  end
  W-->>B: success
  B-->>A: toast "NAME was banned", all queries invalidated, router invalidated
  Note over B: the banned person has no session now. Any request they make finds the user banned, deletes sessions and returns Unauthorized, and sign-in redirects to /login/?error=banned. They cannot move their own photos, so an admin uses Move photos
  A->>B: Unban on a banned row, confirms
  B->>W: unbanUserFn(userId)
  alt not admin
    W-->>B: permission error
  else user missing
    W-->>B: error "User not found"
  else not banned
    W-->>B: error "User is not banned"
  end
  W->>D1: clear banned_at, ban_reason, banned_by
  W->>T: channel log that the user was unbanned
  W-->>B: success
  B-->>A: toast "NAME was unbanned" and refresh (flamekeeping is not restored, they connect Drive again)
  Note over B,W: searching on /admin/flamekeepers only changes the search URL and reruns getAdminFlamekeepersFn
```

## Admin pool cap and freeing space

Both live on the admin dashboard Albums tab. Managers see the pool card read only, and admins can change the cap and expire albums.

```mermaid
sequenceDiagram
  autonumber
  participant A as Admin
  participant B as Browser
  participant W as Worker
  participant D1 as D1
  participant T as Telegram
  participant Mail as Gmail (master account)
  A->>B: edits Per-account cap (GB), clicks Save
  alt value under 1
    B-->>A: toast "Enter a cap of at least 1 GB"
  end
  B->>W: setFlamekeeperCapFn(capGb)
  alt not admin role
    W-->>B: permission error
  else capGb outside 1 to 1024
    W-->>B: validation error
  end
  W->>D1: upsert settings id global, flamekeeper_cap_bytes = capGb times 1 GiB
  W-->>B: success
  B->>B: invalidate the dashboard pool query
  B-->>A: toast "Per-account cap updated" (error toast shows the message or "Failed to save")
  A->>B: Expire now on an album, confirms Expire and notify
  B->>W: expireAlbumNowFn(albumId)
  alt not admin role
    W-->>B: permission error
  else album missing
    W-->>B: error "Album not found"
  else pinned, already deleted or already expiring within 7 days
    W-->>B: error "This album cannot be expired earlier"
  end
  W->>D1: set album.expires_at = now + 7 days, clear 30 day reminder flag, mark 7 day reminder as sent
  W->>D1: find owner and everyone who favorited a live photo in the album
  loop each recipient, owner first
    alt has telegram_chat_id and bot token set
      W->>T: message that the album will be deleted on the date, with link
    end
    opt Telegram not used or failed
      W->>Mail: email "Album TITLE will be deleted on DATE"
    end
  end
  W-->>B: new expiry date and notified count
  B->>B: invalidate dashboard queries and albums queries
  B-->>A: toast "TITLE will be deleted in 7 days. N people notified."
  Note over W: the album is deleted later by the expiry sweep, not in this file
```

## Deleting an account

The Delete my account card shows only to non-members who are not flamekeeping (no flamekeeper row, or state drained).

```mermaid
sequenceDiagram
  autonumber
  participant P as Non-member
  participant B as Browser
  participant W as Worker
  participant D1 as D1
  P->>B: Delete my account, confirms Delete account
  B->>W: deleteMyAccountFn()
  alt no session
    W-->>B: error "Unauthorized"
  else member or still flamekeeping
    W-->>B: error "Club members keep their account. Other accounts can be deleted once any flamekeeping has stopped and the photos have moved."
  end
  W->>D1: delete the user row (flamekeeper, grant, volumes, favorites cascade)
  W-->>B: success
  B-->>P: browser goes to /
  Note over B: on error the toast shows the message or "Could not delete the account"
```
