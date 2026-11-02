# Cron: Flamekeeper Storage Upkeep

Five steps of the 5-minute cron look after flamekeepers (members who lend their Google Drive for album photos): checkFlamekeeperHealth, maintainPool, drainFlamekeepers, finishBans and graduateFlamekeepers. They run in that order after the booking steps and before the album steps, all sharing one run budget of 40 outgoing requests, see 08-cron-overview-and-bookings.md for the full run order. Every step is wrapped so an error is only logged and the next step still runs.

## Data
Two KV keys are touched when album photo lists change: `album:list:<album Drive folder id>` (TTL 300 seconds) and `album:detail:<album id>` (TTL 3600 seconds). These steps only delete them, never write them.

```mermaid
erDiagram
  user ||--o| flamekeeper : "is"
  user ||--o| flamekeeper_grant : "has Drive token"
  user ||--o{ album : owns
  user ||--o{ booking : makes
  booking ||--o{ booking_item : contains
  album ||--o{ volume : "stored in"
  flamekeeper ||--o{ volume : hosts
  album ||--o{ photo : has
  flamekeeper ||--o{ photo : holds
  flamekeeper ||--o{ upload_reservation : reserves
  album ||--o{ upload_reservation : "reserved for"

  user {
    text id PK
    text email
    text name
    text first_name
    text telegram_chat_id
    text role "user, manager, admin"
    integer banned_at
    integer album_count
  }
  flamekeeper {
    text user_id PK "FK user"
    integer pledged_bytes
    integer used_bytes
    integer drive_usage_bytes
    integer drive_usage_checked_at
    text state "active, full, draining, lost, drained"
    text graduation_date "YYYY-MM-DD"
    integer graduation_confirmed_at
    integer graduation_prompt_sent_at
    integer draining_deadline
    text drain_reason "opt_out, pledge, graduation, domain, ban"
    integer drain_reminder_sent_at
    integer drain_admin_started_at
    integer drain_admin_reminded_at
    text health_cursor "album id the audit stopped after"
    integer health_checked_at
    integer lost_since
    integer lost_notified_at
    integer lost_finalized_at
    integer created_at
  }
  flamekeeper_grant {
    text user_id PK "FK user"
    text refresh_token
    integer last_refresh_at
  }
  volume {
    text album_id PK "FK album"
    text flamekeeper_user_id PK "FK user"
    text permission_id
    text drive_folder_id "Drive subfolder, null if forgotten"
    integer release_blocked_at "last failed release try"
    integer release_blocked_since "first failed release try"
    integer release_alerted_at "admins told after 7 days"
    integer dropped_at "set when flamekeeper was lost"
  }
  photo {
    text id PK
    text album_id FK
    text drive_file_id
    integer bytes
    text flamekeeper_user_id
    text state "live, moving, deleted, dropped"
    integer created_at
  }
  album {
    text id PK
    text owner_user_id FK
    text title
    text drive_folder_id
    text cover_file_id
    integer photo_count
    integer photo_bytes
    integer favorite_count
    integer photos_indexed_at
    integer expires_at
    boolean pinned
    text tombstone_reason "expired, flamekeeper_left, flamekeeper_lost, no_space"
    integer deleted_at
  }
  upload_reservation {
    text id PK
    text flamekeeper_user_id FK
    text album_id FK
    integer bytes
    integer expires_at
  }
  settings {
    text id PK "global"
    integer flamekeeper_cap_bytes "default 20 GB"
    integer pool_low_alerted_at
  }
  booking {
    integer id PK
    text user_id FK
    text status "booked, active, returned, cancelled, overdue"
  }
  booking_item {
    integer id PK
    integer booking_id FK
    text status "booked, active, returned, cancelled, overdue"
    text gcal_event_id
  }
```

## Health check: grants, usage and missing photos
Step checkFlamekeeperHealth (runFlamekeeperHealth). It runs on every tick, but a flamekeeper in state active, full or draining is only checked once 24 hours have passed since health_checked_at (never-checked first, then oldest first). This part may spend at most 24 of the 40 requests. A flamekeeper costs 2 when starting fresh (token refresh plus Drive about call) or 1 when resuming from a saved cursor. Every Drive call here uses the flamekeeper's own token, freshly refreshed for this check.
```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Google as Google OAuth
  participant Drive as Drive
  participant KV as KV
  participant Telegram as Telegram

  Cron->>Worker: runFlamekeeperHealth(env, budget)
  Worker->>D1: load flamekeepers in active, full, draining with volume counts
  Worker->>Worker: planHealthBatch picks those due (24h since health_checked_at) while costs fit in 24
  loop each picked flamekeeper
    Worker->>Worker: take 2 from budget (1 if resuming from health_cursor)
    Worker->>Google: refresh token using the flamekeeper's refresh_token
    alt refresh refused as invalid_grant (revoked or no grant)
      Worker->>D1: flamekeeper state = lost, lost_since = now
    else refresh or audit failed for another reason
      Worker->>D1: health_checked_at = now minus 24h plus 1h (retry in about 1 hour)
    else token ok
      Worker->>D1: flamekeeper_grant last_refresh_at = now
      opt not resuming
        Worker->>Drive: about.get (flamekeeper token)
        Worker->>D1: drive_usage_bytes and drive_usage_checked_at = now
        opt Drive email differs from user.email (lowercased, valid)
          Worker->>D1: set user.email to the Drive email (left unchanged if another account has it)
        end
      end
      Worker->>D1: load volumes of this flamekeeper not dropped, albums not deleted, in album id order after health_cursor
      loop each volume
        Worker->>D1: load live photos of this volume created over 1 hour ago
        alt no such photos or volume has no Drive folder id
          Worker->>Worker: skip this volume
        else audit
          Worker->>Drive: list files in volume folder, 1000 per page, 1 budget per page (flamekeeper token)
          Worker->>Worker: missing = live rows whose file id is absent from the listing
          Worker->>Worker: pick at most 10 missing rows at random to confirm, others wait for a later check
          loop each picked row
            Worker->>Drive: files.get id and trashed, 1 budget (flamekeeper token)
            Note over Worker: remove only if Drive says 404 or trashed<br/>exists, or any error, keeps the row
          end
          opt some rows confirmed gone
            Worker->>D1: those photo rows state = deleted (only still-live rows of this flamekeeper)
            Worker->>D1: used_bytes lowered by their bytes (not below 0)
            Worker->>D1: recount album photo_count, photo_bytes, favorite_count and clear cover_file_id if it was one of them
            Worker->>KV: delete album:list and album:detail keys of the album
          end
        end
      end
      alt budget ran out mid audit
        Worker->>D1: health_cursor = last finished album id, health_checked_at = now minus 24h so it resumes next tick
      else all volumes done
        Worker->>D1: health_checked_at = now, health_cursor = null
      end
    end
  end
  opt any photos were removed
    Worker->>Telegram: all admins with a chat id, forced past the budget, 1 per admin
    Note over Telegram: savenuimg hashtag then health check: photos missing from Drive were removed from their albums.<br/>then up to 10 lines like email: count in "album title", then ...and N more albums
  end
```

## Health check: lost flamekeepers and recovery
Same step, second half. A flamekeeper whose Drive grant was revoked is in state lost. They get one reconnect email, and 7 days after lost_since their photos are dropped from the app. If they reconnect later, dropped photos come back.
```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Gmail as Gmail (club account)
  participant KV as KV
  participant Telegram as Telegram
  participant Drive as Drive

  Cron->>Worker: runFlamekeeperHealth(env, budget)
  Worker->>D1: load lost flamekeepers not yet notified or not yet finalized
  Worker->>Worker: planLost notify = not notified and user not banned
  Worker->>Worker: planLost finalize = not finalized and now is 7 days or more after lost_since
  loop up to 3 flamekeepers to notify, 1 budget each
    Worker->>Gmail: send email using the master token
    Note over Gmail: To the flamekeeper. Subject: Reconnect your Google Drive to keep your photos in the app.<br/>Body says the Drive can no longer be reached, asks to reconnect by lost_since plus 7 days (Almaty date) at the profile page, says photos drop out of the app and empty albums are hidden after that date, files stay in Drive and reconnecting brings the photos back
    opt email sent
      Worker->>D1: lost_notified_at = now
    end
  end
  loop first flamekeeper to finalize only, 1 per tick
    Worker->>D1: load up to 10 volumes not dropped (with album and owner)
    loop each volume
      Worker->>D1: count live photos in the album held by anyone else
      Note over Worker: album is tombstoned only if nobody else holds live photos and it is not already deleted
      opt tombstoning and owner has a Telegram chat
        Worker->>Worker: take 1 budget, stop this run if none left
      end
      Worker->>D1: this flamekeeper's live photos state = dropped
      Worker->>D1: used_bytes lowered by their bytes
      Worker->>D1: recount album counts, if tombstoned then deleted_at = now, tombstone_reason = flamekeeper_lost and cover cleared, otherwise clear cover only if it was a dropped photo
      opt tombstoned
        Worker->>D1: owner album_count minus 1
      end
      Worker->>KV: delete album:list and album:detail keys
      Worker->>D1: volume dropped_at = now
      opt tombstoned and owner has a chat id
        Worker->>Telegram: message to the album owner
        Note over Telegram: Your album "title" is gone. The flamekeeper who stored its photos could no longer be reached, so the album is hidden. If they reconnect their Drive before the album expires, it comes back. then the album link
      end
    end
    opt fewer than 10 volumes and not stopped early
      Worker->>D1: lost_finalized_at = now
    end
  end
  Worker->>D1: load up to 2 dropped volumes (by album id) whose flamekeeper is back in active, full or draining and not banned
  loop each of those volumes
    Worker->>Worker: planRecovery
    Note over Worker: abandon if the album was deleted for any reason other than flamekeeper_lost<br/>or the album is unpinned and already past expires_at<br/>otherwise restore
    opt restore, and folder known but no permission_id and no photo rows
      Worker->>Drive: share volume folder as writer with the flamekeeper email (master token, 2 budget)
      alt Drive says folder not found
        Worker->>Worker: switch to abandon
      else other error
        Worker->>Worker: skip this volume until next tick
      end
    end
    Worker->>D1: up to 300 dropped photo rows become live (restore) or deleted (abandon)
    opt restore and rows were changed
      Worker->>D1: used_bytes raised, album counts recounted
      opt album was tombstoned as flamekeeper_lost
        Worker->>D1: album deleted_at = null, tombstone_reason = null, owner album_count plus 1
      end
      Worker->>KV: delete album:list and album:detail keys
    end
    alt no dropped rows left for this volume
      alt restore
        Worker->>D1: volume dropped_at = null, flamekeeper health_checked_at and health_cursor = null so the audit runs again soon
      else abandon
        Worker->>D1: delete the volume row
      end
    end
  end
```

## Pool maintenance
Step maintainPool (runPoolMaintenance). Runs every tick. Makes no Drive calls, only database work and possibly one admin Telegram alert.
```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Telegram as Telegram

  Cron->>Worker: runPoolMaintenance(env, budget)
  Worker->>D1: delete upload_reservation rows that expired more than 24 hours ago
  Worker->>D1: load flamekeepers in active or full with reserved bytes, the cap (default 20 GB) and settings.pool_low_alerted_at
  Worker->>Worker: recoverFull finds full flamekeepers with at least 512 MB usable
  Note over Worker: usable = smaller of pledge left and cap left, after unexpired reservations<br/>pledge left = pledged_bytes minus used_bytes, cap left = cap minus drive_usage_bytes
  opt some recovered
    Worker->>D1: those flamekeepers state = active
  end
  alt no settings row
    Worker->>Worker: stop
  else pool is low and not yet alerted
    Note over Worker: low = free bytes of active flamekeepers under 10 percent of pledged, or nothing pledged
    Worker->>Telegram: all admins with a chat id, 1 budget per admin (not forced)
    Note over Telegram: savenuimg hashtag then pool is low: X GB free of Y GB pledged across N flamekeepers. Recruit flamekeepers or free up space.
    alt sent (or no bot token configured)
      Worker->>D1: settings.pool_low_alerted_at = now
    else no admins with a chat id, or budget too low
      Worker->>Worker: nothing recorded, tries again next tick
    end
  else pool is no longer low and was alerted
    Worker->>D1: settings.pool_low_alerted_at = null (alert re-armed)
  end
```

## Releasing an empty volume
Shared routine releaseVolumes used by drainFlamekeepers (up to 20 volumes per call) and finishBans (up to 10). A volume is the Drive subfolder a flamekeeper holds for one album. It is deleted only when the database shows nothing needs it. Folder deletion uses the club (master) token, clearing leftovers uses the flamekeeper's token.
```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Drive as Drive

  Cron->>Worker: releaseVolumes(scope, limit, budget)
  Worker->>D1: select volumes in scope with no photo row except state deleted and no unexpired upload_reservation
  Note over Worker: volumes already alerted and blocked 7 days or more are left out<br/>oldest release_blocked_at first, limit plus 1 rows read
  Worker->>Worker: planVolumeReleases
  Note over Worker: no Drive folder id means just drop the row<br/>blocked less than 6 hours ago waits<br/>over the limit waits
  Worker->>Worker: take 1 budget, then up to one more per folder to delete
  loop each folder to delete
    Worker->>D1: recheck no photo rows (not deleted) and no unexpired reservation
    Worker->>Drive: delete volume folder (master token)
    alt deleted, or Drive says not found
      Worker->>Worker: counts as done
    else Drive refuses because the folder holds files the app may not touch
      opt fewer than 3 heals so far in this call
        Worker->>D1: flamekeeper must still have a Drive grant
        Worker->>Drive: list up to 50 non-folder, non-trashed files in the volume folder, 3 budget (flamekeeper token)
        Worker->>D1: which listed file ids are still referenced by a photo row not deleted
        alt every listed file is referenced, or volume no longer idle, or no grant
          Worker->>Worker: blocked
        else some are unreferenced
          Worker->>Drive: batch delete only the unreferenced files, 100 per batch (flamekeeper token)
          Note over Worker: result is cleared if fewer than 50 were listed, otherwise incomplete
        end
        opt result cleared and 1 more budget available
          Worker->>Drive: delete volume folder again (master token)
        end
      end
      alt still refused, or any other error
        Worker->>D1: volume release_blocked_at = now, release_blocked_since = now on first failure only
      end
    end
  end
  Worker->>D1: delete the volume rows that are done
  Note over Worker: 7 days after release_blocked_since the volume is abandoned<br/>never retried, alerted once by the drain step, ignored by finalizeDrained
```

## Drain maintenance
Step drainFlamekeepers (runDrainMaintenance). A flamekeeper in state draining has a 14 day deadline to move their photos to other flamekeepers (the move itself is done from their browser or by an admin, outside this step). This step sends alerts and reminders, finishes drains, and deletes what is left after the deadline. It returns early after the abandoned-volume alerts when nobody is draining.
```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Gmail as Gmail (club account)
  participant Google as Google OAuth
  participant Drive as Drive
  participant KV as KV
  participant Telegram as Telegram

  Cron->>Worker: runDrainMaintenance(env, budget)
  Worker->>D1: volumes with release_alerted_at empty and release_blocked_since 7 days or older, oldest first, at most 2
  loop each abandoned volume
    Worker->>Telegram: all admins with a chat id, 1 budget per admin
    Note over Telegram: savenuimg hashtag then a volume of Name and email in angle brackets, in the album "title", could not be emptied for 7 days. Its Drive subfolder still holds files that need manual cleanup.
    alt sent
      Worker->>D1: volume release_alerted_at = now
    else no admins or no budget
      Worker->>Worker: stop the alerts, retry next tick
    end
  end
  Worker->>D1: load flamekeepers in state draining
  opt nobody draining
    Worker->>Worker: stop
  end
  loop at most 2 admin alerts per tick
    Worker->>Telegram: all admins with a chat id, 1 budget per admin
    alt drain_admin_started_at is empty
      Note over Telegram: savenuimg hashtag then drain started: Name and email (reason) has X GB to move off. Deadline DATE, photos still there then are deleted.
      Worker->>D1: drain_admin_started_at = now
    else deadline within 3 days and drain_admin_reminded_at empty
      Note over Telegram: savenuimg hashtag then drain deadline in 3 days: Name and email still holds X GB. Photos left on DATE are deleted. Move them or ask the flamekeeper to.
      Worker->>D1: drain_admin_reminded_at = now
    end
  end
  loop at most 2 reminder emails per tick, never for reason ban, 1 budget each
    Note over Worker: due when the deadline is in the future but within 3 days and drain_reminder_sent_at is empty
    Worker->>Gmail: send email using the master token
    Note over Gmail: To the flamekeeper. Subject: savenuimg hashtag then your photos will be deleted soon.<br/>Body: X GB of club photos are still with you, on DATE photos not moved will be deleted, keep the account page tab open to move them now
    opt sent
      Worker->>D1: drain_reminder_sent_at = now
    end
  end
  Worker->>Worker: pick one overdue flamekeeper at random (now at or after draining_deadline)
  loop each draining flamekeeper
    alt this is the picked overdue one (deleteOverdue)
      Worker->>D1: load up to 200 live photos in their volumes
      Note over Worker: reason pledge deletes the biggest photos first until used is back under the pledge<br/>other reasons delete all of them<br/>limited to 3 albums per tick
      Worker->>Worker: budget cost = 1 plus photos/100 rounded up, plus 1, plus 3 per album, halving the photo list until it fits
      Worker->>Drive: batch delete the files, 100 per batch (flamekeeper token)
      Worker->>D1: deleted photos have their rows removed, album counts recounted, used_bytes and drive_usage_bytes lowered
      Worker->>D1: clear album cover_file_id if it was a deleted file
      loop each album that lost photos
        opt album photo_count is 0 and photos_indexed_at is set and not already deleted
          Worker->>Drive: remove leftover photos and delete the album folder, healing blocked volumes first (master token)
          Worker->>D1: delete photo and volume rows, album deleted_at = now, tombstone_reason = flamekeeper_left, owner album_count minus 1
          Worker->>KV: delete album:list and album:detail keys
          opt owner has a Telegram chat id
            Worker->>Telegram: message to the album owner
            Note over Telegram: Your album "title" is gone. The flamekeeper who stored its photos left the initiative before they could be moved, so the photos were deleted. then the album link
          end
        end
      end
      Worker->>Worker: release empty volumes of those albums, see Releasing an empty volume
      Worker->>D1: advanceDrain
    else not the picked one and fewer than 2 have finished draining so far
      Worker->>D1: advanceDrain
    end
  end
  Note over Worker: advanceDrain, reason pledge and used_bytes now at or under pledged_bytes means state = active with drain fields cleared<br/>other reasons and no live photo left in their volumes means finalizeDrained
  opt finalizeDrained
    Worker->>Worker: release all volumes of the flamekeeper, all must be done
    Worker->>D1: stop unless every remaining volume is abandoned (blocked 7 days or more) and there is no unexpired upload_reservation
    Worker->>Worker: take 1 budget
    Worker->>D1: delete their upload_reservation rows
    Worker->>Google: revoke the refresh token (skipped for the master account)
    Worker->>D1: delete flamekeeper_grant
    Worker->>D1: state = drained, used_bytes = 0, drive_usage_bytes = 0, drain fields cleared
  end
```

## Ban follow-up
Step finishBans (runBanMaintenance). The ban itself is done by an admin (see 05-admin-console.md). This step finishes what a ban leaves behind for users with banned_at set.
```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Calendar as Calendar
  participant Telegram as Telegram

  Cron->>Worker: runBanMaintenance(env, budget)
  Worker->>D1: up to 3 bookings with status booked whose user has banned_at set
  loop each booking
    Worker->>D1: load its items
    Worker->>Worker: take items plus 2 budget, stop the loop if not affordable
    Worker->>D1: cancelBookingItems sets items not already cancelled or returned to cancelled
    Worker->>D1: recompute booking status
    Worker->>Calendar: delete each item's equipment calendar event
    Worker->>Telegram: club channel log, only if bot token and channel id are set
    Note over Telegram: Cancelled event by system with Reason: Account banned and the booking link
  end
  Worker->>Worker: releaseVolumes for volumes of banned users, limit 10, see Releasing an empty volume
```

## Graduation and domain check
Step graduateFlamekeepers (runGraduationMaintenance). Loads every flamekeeper in active, full or draining and decides, in database order, who must start draining. A drain starts when the account email is no longer on nu.edu.kz (reason domain) or when today is 60 days or less before graduation_date (reason graduation). At most 3 drains start per tick, 2 budget each.
```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron
  participant Worker as Worker
  participant D1 as D1
  participant Gmail as Gmail (club account)

  Cron->>Worker: runGraduationMaintenance(env, budget)
  Worker->>D1: load flamekeepers in active, full, draining with user email
  loop each flamekeeper until 3 triggers
    Worker->>Worker: planDomainChange then planGraduation
    Note over Worker: domain applies to active or full, and to draining with reason pledge or graduation (restarts with reason domain)<br/>graduation applies to active or full once now is 60 days before graduation_date or later<br/>and to draining with reason pledge (switches to graduation)
    opt a drain or an immediate finish is planned
      Worker->>Worker: take 2 budget, stop if none left
      alt used_bytes is 0, or no dropped volume and no live photo in their volumes
        Worker->>Worker: finalizeDrained as in Drain maintenance
      else holds photos
        Worker->>D1: state = draining, drain_reason, draining_deadline = now plus 14 days, reminder and admin alert marks cleared
        Worker->>Gmail: send email using the master token
        Note over Gmail: To the flamekeeper. Subject: savenuimg hashtag then we are moving your photos.<br/>Body: the reason, X GB now need to move to other flamekeepers, keep the account page tab open, photos still with you on the deadline date will be deleted
      end
    end
  end
  loop at most 2 prompt emails, skipping anyone whose drain just started, 1 budget each
    Note over Worker: due 365 days after graduation_confirmed_at (or created_at if never confirmed)<br/>not draining, and no prompt sent since that due date
    Worker->>Gmail: send email using the master token
    Note over Gmail: To the flamekeeper. Subject: savenuimg hashtag then is your graduation date still right?<br/>Body: expected graduation date is DATE, photos are moved 60 days before it, please confirm or change it
    opt sent
      Worker->>D1: graduation_prompt_sent_at = now
    end
  end
```
