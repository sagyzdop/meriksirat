# Cron: Album Expiry, Public Notices, Photo Backfill, Bot Menu and Stale Signups

The last five steps of the 5-minute cron run: `expireAlbums`, `notifyPublicAlbums`, `backfillAlbumPhotos`, `configureTelegramBot` and `cleanupStaleSignups`. The clock triggers them. An admin can also bring an album's expiry forward with "Expire now". The full run order and the shared 40-request budget are in 08-cron-overview-and-bookings.md.

## Data

Cloudflare KV keys touched: `album:list:DRIVE_FOLDER_ID` (album file listing, TTL 300 seconds) and `album:detail:ALBUM_ID` (album page core, TTL 3600 seconds) are deleted when an album is removed. `photo-backfill:budget` (JSON with the UTC day and writes spent, TTL 2 days) is the backfill's daily write counter.

```mermaid
erDiagram
  user ||--o{ album : owns
  user ||--o{ album_member : joins
  album ||--o{ album_member : has
  album ||--o{ photo : holds
  album ||--o{ volume : has
  user ||--o{ favorite : makes
  photo ||--o{ favorite : receives
  user ||--o| flamekeeper : is
  user ||--o| flamekeeper_grant : has
  user ||--o{ session : has
  user ||--o{ account : has

  user {
    text id PK
    text email "unique"
    text telegramChatId "null means no Telegram"
    text role "user, manager, admin"
    boolean isMember "false until club code accepted"
    timestamp bannedAt
    timestamp createdAt
    integer albumCount "owned live albums"
  }
  album {
    text id PK
    text ownerUserId FK
    text title
    text driveFolderId "master Drive folder"
    text coverFileId
    integer photoCount
    integer photoBytes
    integer favoriteCount
    timestamp photosIndexedAt "null means not yet indexed"
    timestamp photosIndexRequestedAt
    text photosIndexSkipped "trashed, missing"
    timestamp expiresAt "event date plus 2 years"
    boolean pinned "pinned albums never expire"
    text tombstoneReason "expired, flamekeeper_left, flamekeeper_lost, no_space"
    timestamp deletedAt "set when tombstoned"
    timestamp expiryReminder30SentAt
    timestamp expiryReminder7SentAt
    timestamp publicNoticePendingAt "set once by migration 0026"
    timestamp eventDate
    timestamp createdAt
  }
  album_member {
    text albumId FK
    text userId FK
  }
  photo {
    text id PK
    text albumId FK
    text driveFileId "unique"
    integer bytes
    text flamekeeperUserId "null means master Drive"
    text state "live, moving, deleted, dropped"
  }
  volume {
    text albumId PK
    text flamekeeperUserId PK
    text driveFolderId "subfolder named Volume xxxxxx"
    text permissionId
  }
  favorite {
    text userId PK
    text photoId PK
  }
  flamekeeper {
    text userId PK
    integer usedBytes
    integer driveUsageBytes
    text state "active, full, draining, lost, drained"
  }
  flamekeeper_grant {
    text userId PK
    text refreshToken
  }
  session {
    text userId FK
  }
  account {
    text userId FK
  }
```

## An album from creation to expiry

Albums live two years after their event date. Only the cron warnings and the removal are covered in detail in the sections below. Creation, date edits and pinning belong to the albums scenario files.

```mermaid
sequenceDiagram
  autonumber
  participant Member
  participant Admin
  participant Worker
  participant D1
  participant Cron
  participant Telegram

  Member->>Worker: createAlbumFn (see the albums scenario file)
  Worker->>D1: insert album with expiresAt = eventDate + 2 years, photosIndexedAt = now
  Note over Worker,D1: Album is public from day one. Reminder columns stay empty.
  opt Member edits the event date and album is not pinned
    Member->>Worker: updateAlbumFn
    Worker->>D1: expiresAt = new eventDate + 2 years, both reminder columns = null
  end
  opt Admin pins the album
    Admin->>Worker: setAlbumPinnedFn
    Worker->>D1: pinned = true
    Note over Cron,D1: Pinned albums are skipped by every expiry check and warning
  end
  Note over Cron,D1: Every 5 minutes expireAlbums reads all albums with deletedAt empty and pinned false
  Cron->>Worker: expireAlbums at 30 days or less (more than 7 days) left
  Worker->>Telegram: 30-day text to owner and members who have a chat id
  Worker->>D1: expiryReminder30SentAt = now
  Note over Member: Album page shows banner "Will be deleted on DATE" from 30 days out
  Cron->>Worker: expireAlbums at 7 days or less left
  Worker->>Telegram: 7-day text to owner and members who have a chat id
  Worker->>D1: expiryReminder7SentAt = now
  Note over Worker,D1: An album first seen with 7 days or less left skips the 30-day text and only gets the 7-day text
  opt Admin brings it forward with Expire now
    Admin->>Worker: expireAlbumNowFn (see Admin brings an album's expiry forward below)
    Worker->>D1: expiresAt = now + 7 days, expiryReminder30SentAt = null, expiryReminder7SentAt = now
  end
  Cron->>Worker: expireAlbums when expiresAt is now or past
  Worker->>D1: album tombstoned with reason expired, deletedAt = now, photoCount and photoBytes = 0, coverFileId = null
  Note over Member: Album page shows "This album has expired". Albums are kept for two years after their event, and there is no backup copy. The photos have been deleted.
```

## Expiring albums and sending warnings

Runs every 5 minutes. It reads every album with `deletedAt` empty and `pinned` false and does nothing, and spends no budget, if no album is overdue and no warning is due. An album with no `expiresAt` is never touched. Up to 3 albums are attempted per run, and each attempt counts toward the 3 even if it fails or is deferred. The overdue list is rotated by the current 5-minute turn (time divided by 5 minutes, modulo list length), so one stuck album cannot block the others. Drive calls use the master Google account token for the album folder and each flamekeeper's own token for photos they stored.

```mermaid
sequenceDiagram
  autonumber
  participant Cron
  participant Worker
  participant D1
  participant KV
  participant Drive
  participant Telegram

  Cron->>Worker: expireAlbums then runAlbumExpiry(env, budget)
  Worker->>D1: select albums where deletedAt is null and pinned = false
  Worker->>Worker: planExpiry splits into expire (expiresAt at or before now), remind7 (7 days or less left, reminder7 empty), remind30 (over 7 and up to 30 days left, reminder30 empty)
  alt nothing to expire and nothing to remind
    Worker-->>Cron: return without spending budget
  end

  opt at least one album is overdue
    Worker->>Worker: rotateIds(expire, turn) where turn = floor(now / 5 minutes)
    loop each overdue album until 3 attempted (EXPIRES_PER_RUN)
      Worker->>D1: removalCost counts photos per flamekeeper owner
      Note over Worker: Cost estimate = 1 + for each flamekeeper owner with photos (1 + ceil(photos / 100)) + 1 for the first master token in this run
      alt budget cannot afford the cost
        Worker->>Worker: skip this album and try the next one
      else affordable
        Worker->>Worker: removeAlbum(tombstone expired, strictDrive true)
        Worker->>D1: loadOwnedPhotos (photo rows with a flamekeeper owner, at most 2001 read)
        opt album has flamekeeper photos
          Worker->>Worker: take first 2000 as one batch (MAX_PHOTO_DELETES_PER_CALL)
          loop each flamekeeper owner in the batch
            Worker->>Drive: batch delete files with the flamekeeper token, 100 files per request
            Note over Worker,Drive: A 401 on a cached token forgets it, then retries once if budget affords 2
            alt owner's Drive grant is missing or revoked and flamekeeper is lost, drained or has no row
              Worker->>Worker: photos marked lost, nothing deleted in Drive
            else a file failed with anything other than success or 404
              Worker->>Worker: remember error and keep those photo rows
            else all files deleted or already 404
              Worker->>D1: flamekeeper usedBytes and driveUsageBytes reduced by the bytes (not below 0)
            end
          end
          Worker->>D1: delete photo rows for deleted and lost files only, recount album photoCount photoBytes favoriteCount
          alt a Drive error was remembered
            Worker->>Worker: throw so album stays unexpired, logged "Failed to expire album ID", retried next run
          else more than 2000 owned photos existed
            Worker->>Worker: throw error "This album is too large to delete in one go. Some photos were deleted" plus "try again to continue", retried next run
          end
        end

        alt some photos were lost (flamekeeper unreachable)
          Worker->>Worker: warn and keep the Drive folder, skip folder delete
        else all owned photos gone or none existed
          Worker->>Drive: delete album folder with the master token (1 request)
          alt Drive 404
            Worker->>Worker: treated as already deleted
          else Drive 403 appNotAuthorizedToChild (folder holds files the app cannot touch)
            Worker->>D1: healAlbumVolumes reads volume rows that have a driveFolderId
            Note over Worker,D1: At most 4 volumes are worked per attempt. Further ones count as incomplete.
            loop each volume
              alt flamekeeper has no flamekeeper_grant row
                Worker->>Worker: outcome blocked (no cost)
              else budget cannot afford 3
                Worker->>Worker: outcome incomplete
              else
                Worker->>Drive: list up to 50 non-folder files in the volume folder with the flamekeeper token
                alt folder listing is empty
                  Worker->>Worker: outcome cleared
                else files found
                  Worker->>D1: look up which listed files still have a photo row that is not deleted
                  Note over Worker: Safe to delete only files with no live photo row, and only when the flamekeeper has no non-deleted photo rows in the album and no unexpired upload reservation
                  alt nothing deletable or volume is not idle
                    Worker->>Worker: outcome blocked
                  else
                    Worker->>Drive: batch delete the stray files with the flamekeeper token
                    Worker->>Worker: outcome incomplete if 50 files were listed, else cleared
                  end
                end
              end
            end
            alt any volume incomplete
              Worker->>Worker: throw AlbumDeletionDeferredError, log "Expiry of album ID deferred to a later run"
            else no blocked volume, at least one cleared, first attempt
              Worker->>Drive: delete album folder again with the master token (1 budget)
              Note over Worker: If budget cannot afford 1, deferred. A second 403 then abandons the folder.
            else blocked volumes remain or nothing cleared
              Worker->>Worker: warn that the album keeps its Drive folder
              Worker->>D1: read admins who have a chat id
              alt no admin with a chat id
                Worker->>Worker: continue anyway, folder is left in Drive
              else budget cannot afford one message per admin
                Worker->>Worker: throw AlbumDeletionDeferredError, retried next run
              else
                Worker->>Telegram: to each admin "savenuimg: album ID was deleted but N of its volume subfolders could not be emptied, so its Drive folder may still hold public files that need manual cleanup."
                Note over Worker,Telegram: When N is 0 the text says its Drive folder could not be removed
              end
            end
          else any other Drive error
            Worker->>Worker: throw, album stays, logged "Failed to expire album ID", retried next run
          end
        end

        Worker->>KV: delete album:list:DRIVE_FOLDER_ID and album:detail:ALBUM_ID
        Worker->>D1: delete all photo rows and volume rows of the album (favorites go with the photos)
        Worker->>D1: album deletedAt = now, tombstoneReason = expired, photoCount 0, photoBytes 0, coverFileId null
        Worker->>D1: owner albumCount = albumCount - 1 (not below 0)
      end
    end
  end

  opt TELEGRAM_BOT_TOKEN is set and some albums need a warning
    Worker->>D1: load owner chat id and member chat ids for those albums (90 albums per query)
    loop 30-day albums first, then 7-day albums
      Worker->>Worker: reminderRecipients removes blanks and duplicates, owner first
      alt budget cannot afford one request per recipient
        Worker->>Worker: stop all remaining warnings until the next run
      else
        loop each recipient with a chat id
          Worker->>Telegram: Your album "TITLE" will be deleted in 30 days (or 7 days), on DATE. There is no backup, so download the photos you want to keep. plus link to the album page when BETTER_AUTH_URL is set
        end
        alt recipients exist and every send failed
          Worker->>Worker: leave the reminder column empty so the next run retries
        else at least one sent, or no recipient has a chat id
          Worker->>D1: expiryReminder30SentAt or expiryReminder7SentAt = now
        end
      end
    end
  end
  opt no bot token and warnings were due
    Worker->>Worker: warn "TELEGRAM_BOT_TOKEN not configured, skipping expiry reminders" and send nothing
  end
```

## Admin brings an album's expiry forward

An admin opens the dashboard card "Free up space", which lists unpinned live albums ranked by: albums with no favorites first, then earliest expiry, then biggest. Clicking "Expire now" on a row asks for confirmation. Nothing is deleted at that moment. The album's deadline becomes 7 days from now and the normal cron removal in the section above does the deletion.

```mermaid
sequenceDiagram
  autonumber
  participant Admin
  participant Browser
  participant Worker
  participant D1
  participant Telegram
  participant Email

  Admin->>Browser: open admin dashboard
  Browser->>Worker: getDeletionSuggestionsFn()
  Worker->>Worker: checkAdminPermission(admin only)
  Worker->>D1: select albums where deletedAt is null and pinned = false
  Worker-->>Browser: list sorted by no favorites first, then expiresAt soonest (none last), then photoBytes largest
  Admin->>Browser: click Expire now and confirm
  Browser->>Worker: expireAlbumNowFn(albumId)
  Worker->>Worker: checkAdminPermission(admin only)
  Worker->>D1: load the album
  alt album not found
    Worker-->>Browser: error "Album not found"
    Browser->>Admin: toast "Album not found"
  else deleted, pinned, or expiresAt already within 7 days
    Worker-->>Browser: error "This album cannot be expired earlier"
    Browser->>Admin: toast "This album cannot be expired earlier"
  else allowed
    Worker->>D1: expiresAt = now + 7 days, expiryReminder30SentAt = null, expiryReminder7SentAt = now
    Note over Worker,D1: Reminder 7 is pre-marked as sent so the cron does not send a second warning
    Worker->>D1: select distinct owner and users who favorited a live photo in the album
    loop owner first, then each favoriter, once per person
      alt person has a telegramChatId
        Worker->>Telegram: owner text "Your album TITLE will be deleted on DATE to free up storage. There is no backup, so download the photos you want to keep." plus link
        Note over Worker,Telegram: Favoriters get "An album with photos you favorited, TITLE, will be deleted on DATE to free up storage..." instead
      end
      opt no chat id, or the Telegram send failed
        Worker->>Email: sendEmail with subject Album "TITLE" will be deleted on DATE and the same text
      end
    end
    Worker-->>Browser: expiresAt and notified count
    Browser->>Admin: toast "TITLE will be deleted in 7 days. N people notified." (1 person for 1)
    Browser->>Browser: invalidate queries admin-dashboard and albums
  end
```

## Telling owners their old albums are now public

Only albums that had `publicNoticePendingAt` set can be notified. The only code that sets it is migration 0026, once, for albums that were not shared at the time. New albums never get it. The step runs every 5 minutes and does nothing when no live album has the column set.

```mermaid
sequenceDiagram
  autonumber
  participant Cron
  participant Worker
  participant D1
  participant Telegram

  Cron->>Worker: notifyPublicAlbums then runPublicAlbumNotices(env, budget)
  Worker->>D1: select albums where publicNoticePendingAt is set and deletedAt is null, oldest first, joined to owner
  alt none pending
    Worker-->>Cron: return
  else TELEGRAM_BOT_TOKEN missing
    Worker->>Worker: warn "TELEGRAM_BOT_TOKEN not configured, leaving public album notices pending"
  else
    Worker->>Worker: group albums by owner
    loop each owner
      alt owner has no telegramChatId
        Worker->>D1: publicNoticePendingAt = null for that owner's albums (no message, no budget)
      else 5 owners already messaged this run or budget cannot afford 1
        Worker->>Worker: stop, remaining owners wait for the next run
      else
        Worker->>Telegram: one message (1 budget)
        Note over Worker,Telegram: One album: Your album "TITLE" is now public and listed in the gallery. Anyone with the link could already open its Drive folder, so nothing else changes. plus album link
        Note over Worker,Telegram: Several albums: "N of your albums are now public and listed in the gallery:" then up to 10 titles, "and K more", the same closing line and the gallery link
        alt send failed
          Worker->>Worker: log error, columns stay set, retried next run
        else sent
          Worker->>D1: publicNoticePendingAt = null for that owner's albums
        end
      end
    end
  end
```

## Indexing old albums' photos into the database

Albums created now are marked indexed at creation. This step only handles older albums where `photosIndexedAt` is empty and no skip reason is set, including any album whose page was opened and asked for indexing (`photosIndexRequestedAt`). It runs every 5 minutes and does nothing when the daily write budget is gone or no such album exists. All Drive calls use the master account token.

```mermaid
sequenceDiagram
  autonumber
  participant Cron
  participant Worker
  participant KV
  participant D1
  participant Drive

  Cron->>Worker: backfillAlbumPhotos then runPhotoBackfill(env, budget)
  Worker->>KV: read photo-backfill:budget (UTC day and writes spent today)
  Note over Worker,KV: A new UTC day resets spent to 0. Daily limit is env PHOTO_BACKFILL_DAILY_WRITE_BUDGET, default 60000.
  alt fewer than 3 writes left today after reserving 1
    Worker-->>Cron: return
  end
  Worker->>D1: select albums with photosIndexedAt null, photosIndexSkipped null, deletedAt null
  alt none
    Worker-->>Cron: return
  end
  alt cron budget cannot afford 1
    Worker-->>Cron: return
  end
  Worker->>Drive: master access token (1 budget)
  Note over Worker: Up to 5 albums and 500 photos per run. Each album costs 2 budget plus 1 per extra page of 1000 files.
  loop up to 5 albums (MAX_ALBUMS_PER_RUN)
    Worker->>Worker: affordable photos = min(floor((daily budget - spent - 1) / 3), photos left of 500)
    alt zero affordable or cron budget cannot afford 2
      Worker->>Worker: stop the loop
    end
    Worker->>Worker: pick next album: requested albums first (oldest request first), then newest event date or creation date
    Worker->>Drive: getDriveFolderState(folderId)
    alt folder is in the Drive bin
      Worker->>D1: photosIndexSkipped = trashed
      Worker->>Worker: count 1 write, next album
    else folder permanently gone (404)
      Worker->>D1: photosIndexSkipped = missing
      Worker->>Worker: count 1 write, next album
    else other error
      Worker->>Worker: log "Photo backfill failed for album ID", retried next run
    else ok
      Worker->>Drive: list files 1000 per page, non-folder, not trashed
      Worker->>D1: read known photo.driveFileId for this album
      Worker->>Worker: missing = image files with no photo row, take only the affordable count
      Worker->>D1: insert photo rows 6 per statement, ignore duplicates on driveFileId
      alt all missing photos were taken
        Worker->>D1: add to photoCount and photoBytes, photosIndexedAt = now
      else some left over
        Worker->>D1: add to photoCount and photoBytes, album stays unindexed for the next run
      end
      Worker->>Worker: record spend = 3 per photo + 1 (at least 1)
    end
  end
  Worker->>KV: write photo-backfill:budget with 2-day TTL, only if the count changed
  Note over Worker,D1: A skipped album is retried only after restoreAlbumFolderFn clears photosIndexSkipped (see the albums scenario file)
```

## Clearing the Telegram command menu

Every run, 288 times a day, with no condition other than the bot token being set. It costs 1 of the 40 requests. Nothing is stored or sent to people.

```mermaid
sequenceDiagram
  autonumber
  participant Cron
  participant Worker
  participant Telegram

  Cron->>Worker: configureTelegramBot then configureTelegramBot(env, budget)
  alt no TELEGRAM_BOT_TOKEN
    Worker-->>Cron: return
  else budget cannot afford 1
    Worker-->>Cron: return
  else
    Worker->>Telegram: setMyCommands with one command start "Open the main menu"
    Note over Worker,Telegram: Any error is logged "Error in configureTelegramBot" and the run goes on
  end
```

## Deleting unfinished signups

Runs last, every 5 minutes, and does not use the request budget (database only). A person who signed in with Google but never entered the club code is removed 7 days after account creation. At most 20 accounts, oldest first, are removed per run. No message is sent to the person.

```mermaid
sequenceDiagram
  autonumber
  participant Cron
  participant Worker
  participant D1

  Cron->>Worker: cleanupStaleSignups then runStaleSignupCleanup(env)
  Worker->>D1: select users (oldest first, at most 100) where isMember = false and bannedAt is null
  Note over Worker,D1: Also required: email is not an alumni.nu.edu.kz address, email is not GOOGLE_MASTER_EMAIL, createdAt is 7 days ago or older, no flamekeeper row, no flamekeeper_grant row
  Note over Worker,D1: And owns nothing: no booking, no album, no album_member, no favorite, no volume or photo as flamekeeper
  Worker->>Worker: selectStaleSignups repeats the same checks and keeps the oldest 20
  alt no one qualifies
    Worker-->>Cron: return
  else
    Worker->>D1: delete session rows of those users
    Worker->>D1: delete account rows of those users
    Worker->>D1: delete the user rows
    Worker->>Worker: log "Deleted N unfinished signup(s)"
  end
  Note over Cron,Worker: Any error is logged "Error in cleanupStaleSignups" and does not stop the cron
```

## What the 5-minute clock does not do

The only schedule in the project is `*/5 * * * *` in `wrangler.jsonc`, handled by `scheduled` in `server.ts` and its 13 steps. Birthdays have no timer. The birthday calendar is only reconciled when someone saves their data, and the birthday wish drawer is computed when a member loads it.

```mermaid
sequenceDiagram
  autonumber
  participant Member
  participant Admin
  participant Browser
  participant Worker
  participant D1
  participant Calendar

  alt Member finishes onboarding or saves profile, or admin edits a user
    Member->>Browser: save
    Browser->>Worker: completeTelegramOnboardingFn, updateUserProfileFn or updateUserAdminFn
    Worker->>Calendar: reconcileBirthdaysToCalendar (see the onboarding and users scenario files)
  else Admin or manager taps sync
    Admin->>Browser: sync birthdays
    Browser->>Worker: syncBirthdaysToCalendarFn()
    Worker->>Worker: checkAdminPermission(admin, manager)
    Worker->>Calendar: reconcileBirthdaysToCalendar
  else any member loads the app
    Browser->>Worker: getBirthdayWishMessageFn()
    Worker->>D1: members with a birthday today
    Worker-->>Browser: wish message or null, nothing is sent by the server
  end
```
