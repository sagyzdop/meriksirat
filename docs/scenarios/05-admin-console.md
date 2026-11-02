# Admin Console

The admin and manager pages that are not about bookings, equipment or flamekeepers: dashboard, members and alumni lists, member detail, bans, birthdays, settings, club code, test email, broadcast, CSV exports and equipment categories. Triggered by admins and managers in the browser, plus the 5-minute cron finishing a ban.

## Data

KV holds album folder listings under `album:list:{driveFolderId}` with a 300 second TTL. The dashboard reads them and never writes them.

```mermaid
erDiagram
  user {
    text id PK
    text email "unique"
    text name
    text first_name
    text last_name
    text birthday "ISO timestamp or YYYY-MM-DD"
    integer wants_birthday_congratulation
    text status "Active, Inactive, On Probation, Board, Ex-Board, Roommate, Ex-Roommate, Graduated"
    integer clearance_level "1 to 10"
    text role "user, manager, admin"
    integer is_member
    integer banned_at
    text ban_reason
    text banned_by
    integer cancelled_in_start_window_count
    integer overdue_count
    integer album_count
    text telegram_chat_id
    text telegram_username
  }
  session {
    text id PK
    text user_id FK
  }
  settings {
    text id PK "always global"
    text global_booking_note
    text club_code
    text birthdays_calendar_id
    integer operating_hours_start "minutes 0 to 1439"
    integer operating_hours_end "minutes 0 to 1439"
  }
  category {
    integer id PK
    text name "unique"
    text description
    integer sort_order
  }
  equipment {
    integer id PK
    integer category_id FK
    integer is_active
  }
  booking {
    integer id PK
    text user_id FK
    integer start_time
    text status "booked, active, returned, cancelled, overdue, partially_returned"
  }
  album {
    text id PK
    text owner_user_id FK
    text title
    text drive_folder_id
    integer photo_count
    integer photo_bytes
    integer photos_indexed_at
    integer deleted_at
  }
  album_member {
    text id PK
    text album_id FK
    text user_id FK
  }
  flamekeeper {
    text user_id PK
    text state "active, full, draining, lost, drained"
  }
  volume {
    text album_id FK
    text flamekeeper_user_id FK
  }
  user ||--o{ session : has
  user ||--o{ booking : makes
  user ||--o{ album : owns
  user ||--o{ album_member : co_authors
  album ||--o{ album_member : has
  user ||--o| flamekeeper : may_be
  user ||--o{ volume : holds
  category ||--o{ equipment : groups
```

## Opening the admin area and loading its pages

Every page under /admin first passes the admin layout guard. Each loader function below checks the caller again on the server. `checkAdminPermission` is the shared check. It refuses with "Unauthorized: No session", "Unauthorized: User not found" or "Insufficient permissions". Admin only functions are marked.

```mermaid
sequenceDiagram
  autonumber
  actor Person as Admin or Manager
  participant Browser
  participant Worker
  participant D1
  participant KV
  participant Drive

  Person->>Browser: open any /admin page
  Browser->>Worker: getUserFn()
  Worker->>D1: resolve session (a banned user has sessions deleted and gets null)
  Worker-->>Browser: user profile or null
  alt no user
    Browser-->>Person: error "Unauthorized"
  else role is not admin or manager
    Browser-->>Person: error "Page not found"
  end

  Note over Browser,Worker: Dashboard route loader preloads stats and alerts
  Browser->>Worker: getAdminDashboardStatsFn(startDate, endDate)
  Worker->>D1: albums created in range (default is current month)
  Worker->>D1: booking counts by status for bookings starting in range
  Worker->>D1: albums in range with photo counts
  opt some albums have photos_indexed_at empty
    Worker->>Drive: list folder files (master token) 4 albums at a time
    Note over Worker,KV: album:list:{folderId} is read from KV first and only uncached albums hit Drive
    Drive-->>Worker: image count and bytes, errors are logged and skipped
  end
  Worker-->>Browser: albumsPerMonth, bookingStats, albumStorage
  Browser->>Worker: getAdminDashboardAlertsFn()
  Worker->>D1: count overdue bookings, active bookings
  Worker->>D1: count booked bookings starting within 15 minutes
  Worker->>D1: count users with cancelled_in_start_window_count or overdue_count above 1
  Worker->>D1: count users with no telegram_chat_id
  Worker->>KV: read cached listing state of every live album folder
  Worker-->>Browser: alerts list (danger, warning, info)
  Note over Browser: alerts refetch every 60 seconds, stats stay fresh for 60 seconds

  Note over Browser,Worker: Dashboard tabs fetch only when opened
  Person->>Browser: open Albums tab
  Browser->>Worker: getAdminMostActiveUsersFn(range, search, page, sort)
  Worker->>D1: users ranked by owned plus co-authored albums in range
  Note over Browser,Worker: the same tab also loads the pool and free space panels, see 07-flamekeepers.md
  Person->>Browser: open Violations tab
  Browser->>Worker: getViolationsFn(violationType, search, page, sort)
  Worker->>D1: users with either violation counter above 0
  Person->>Browser: open Settings tab
  Browser->>Worker: getSettingsFn()
  Worker->>D1: read settings row global
  opt row missing
    Worker->>D1: insert settings global (empty note, hours 0 to 1439)
  end
  Worker-->>Browser: settings without the club code
  opt viewer is an admin
    Browser->>Worker: getClubCodeFn() (admin only)
    Worker->>D1: read settings.club_code
    opt no code stored yet
      Worker->>D1: generate and store a new club code
    end
    Worker-->>Browser: club code
  end

  Person->>Browser: open Members list
  Browser->>Worker: getAdminUsersFn(role, status, clearanceLevel, search, page, limit 50, sort)
  Worker->>D1: users with is_member true, filtered, sorted, paged, with flamekeeper state
  Person->>Browser: open Alumni tab
  Browser->>Worker: getAdminAlumniFn(search, page, limit 50, sort)
  Worker->>D1: users whose email ends with @alumni.nu.edu.kz
  Person->>Browser: open a member row
  Browser->>Worker: getAdminUserByIdFn(userId)
  Worker->>D1: read the user including ban fields and counters
  alt user missing
    Browser-->>Person: error "Failed to load user data"
  end
  Browser->>Worker: getAdminUserAlbumsFn(userId, search, page, sort)
  Worker->>D1: albums the user owns or co-authors, not deleted, with co-author count
  Person->>Browser: open Birthdays page
  Browser->>Worker: getUpcomingBirthdaysFn(search, wantsCongratulation, page, limit 50, sort)
  Worker->>D1: users with status Active or Board and a birthday
  Worker->>Worker: compute next birthday and turning age, sort and page in memory
  Person->>Browser: open Categories page
  Browser->>Worker: getCategoriesWithCountFn()
  Worker->>D1: categories with equipment count ordered by sort_order
  Worker-->>Browser: rows shown in each table
  Note over Browser,Worker: getAdminStatsFn() counts users, active equipment and bookings but no page calls it
```

## Changing a member's role, status or clearance, and clearing violations

Inline dropdowns on the Members list call `updateUserAdminFn` one field at a time. Selecting rows and choosing Edit Clearance calls `bulkUpdateUserClearanceFn`. Only an admin sees the Manager and Admin role options enabled. Clearing violations is on the member detail page.

```mermaid
sequenceDiagram
  autonumber
  actor Person as Admin or Manager
  participant Browser
  participant Worker
  participant D1
  participant Calendar

  Person->>Browser: change Role, Clearance Level or Status dropdown on a row
  Browser->>Worker: updateUserAdminFn(userId, one field)
  Worker->>Worker: checkAdminPermission(admin or manager)
  Worker->>D1: read target user
  alt target not found
    Worker-->>Browser: error "User not found"
  else role is manager or admin and target is not a club member
    Worker-->>Browser: error "Only club members can be assigned the manager or admin role."
  else role is manager or admin and caller is a manager
    Worker-->>Browser: error "Insufficient permissions to assign admin or manager roles. Only admins can assign these roles."
  else no field to update
    Worker-->>Browser: error "No valid fields provided for update"
  else allowed
    Worker->>D1: update user with the changed field
    opt status was changed
      Worker->>Calendar: reconcile birthdays (master token), errors only logged
      Note over Worker,Calendar: see the birthday calendar scenario below
      opt new status is Inactive
        Worker->>D1: delete all sessions of the target user
      end
    end
    Worker-->>Browser: updated user
    Browser->>Browser: invalidate queries with prefix users
    Browser-->>Person: toast "User updated" and the list refetches
  end
  Browser-->>Person: on error toast "Failed to update user" with the message below it

  Person->>Browser: tick rows and click Edit Clearance (n)
  Browser->>Browser: dialog asks for Level 1 to 10
  Person->>Browser: click Update All
  Browser->>Worker: bulkUpdateUserClearanceFn(userIds, clearanceLevel)
  Worker->>Worker: checkAdminPermission(admin or manager)
  alt no ids
    Worker-->>Browser: error "No user IDs provided"
  else ok
    Worker->>D1: set clearance_level for all given users
    Worker-->>Browser: success and count
    Browser->>Browser: clear row selection and invalidate prefix users
    Browser-->>Person: toast "Updated clearance level for n user(s)"
  end
  Browser-->>Person: on error toast "Failed to update users"

  Person->>Browser: open member detail and click Clear Violations
  Browser->>Browser: confirm dialog "Reset this user's violation counters to zero?"
  Person->>Browser: click Clear Violations in the dialog
  Browser->>Worker: resetUserViolationCountersFn(userId)
  Worker->>Worker: checkAdminPermission(admin or manager)
  Worker->>D1: set cancelled_in_start_window_count and overdue_count to 0
  alt no row changed
    Worker-->>Browser: error "User not found"
    Browser-->>Person: toast with the message or "Failed to reset counters"
  else ok
    Worker-->>Browser: success
    Browser->>Browser: invalidate all queries and the router
    Browser-->>Person: toast "Violation counters reset"
  end
```

## Banning and unbanning a member

Only admins see the Ban section on the member detail page, and an admin does not see Ban on their own page. A ban takes effect at once for sign-in, then bookings and Drive access are cleaned up. Whatever does not fit in the request is finished by the 5-minute cron.

```mermaid
sequenceDiagram
  autonumber
  actor Person as Admin
  participant Browser
  participant Worker
  participant D1
  participant Drive
  participant Telegram
  participant Cron

  Person->>Browser: click Ban user on member detail
  Browser->>Browser: dialog "Ban name?" with required reason box, max 500 characters
  Note over Browser: the Ban user button stays disabled while the reason is empty
  Person->>Browser: click Ban user
  Browser->>Worker: banUserFn(userId, reason)
  Worker->>Worker: checkAdminPermission(admin only)
  alt reason empty after trimming
    Worker-->>Browser: error "Give a reason for the ban"
  else reason over 500 characters
    Worker-->>Browser: error "Keep the reason under 500 characters"
  else target is the caller
    Worker-->>Browser: error "You cannot ban yourself"
  else target not found
    Worker-->>Browser: error "User not found"
  else target is the club master account
    Worker-->>Browser: error "The club account owns every album folder and cannot be banned."
  else already banned
    Worker-->>Browser: error "User is already banned"
  else allowed
    Worker->>D1: set banned_at now, ban_reason, banned_by, updated_at
    Worker->>D1: delete all sessions of the target
    Worker->>D1: read flamekeeper row and whether live photos remain
    alt target is a flamekeeper active or full with photos
      Worker->>D1: set flamekeeper state draining, reason ban, deadline now plus 14 days
      Note over Worker,D1: photo movement is then handled, see 07-flamekeepers.md
    else active or full with no photos
      Worker->>D1: finish the drain at once, see 07-flamekeepers.md
    else already draining for another reason
      Worker->>D1: switch to ban, keeping the earlier deadline if sooner
    else other states or not a flamekeeper
      Worker->>D1: nothing changes for flamekeeper
    end
    Worker->>Telegram: club channel log "User banned by admin" with name, reason and link to /admin/users/id
    Worker->>D1: find up to 3 booked bookings of banned users
    loop each booking
      Worker->>D1: cancel all items of the booking
      Worker->>Telegram: club channel log booking cancelled, reason "Account banned", actor system
      Note over Worker,D1: see the bookings scenario file for what cancelling does
    end
    Worker->>D1: find up to 10 volumes of banned flamekeepers with no photos left
    loop each idle volume
      Worker->>Drive: delete the volume folder (master token)
    end
    Note over Worker: errors here are only logged, the cron continues the work
    Worker-->>Browser: success
    Browser->>Browser: invalidate all queries and the router
    Browser-->>Person: toast "name was banned" and the page shows Banned date and reason
  end
  Browser-->>Person: on error toast with the message or "Failed to ban user"

  Cron->>Worker: finishBans step every 5 minutes
  Worker->>D1: up to 3 booked bookings of banned users
  loop each booking, only while the request budget allows
    Worker->>D1: cancel booking items
    Worker->>Telegram: club channel log booking cancelled "Account banned"
  end
  Worker->>D1: up to 10 idle volumes of banned flamekeepers
  Worker->>Drive: delete volume folders (master token), budget permitting

  Note over Person,Worker: A banned person who signs in again is signed out and sent to /login/?error=banned
  Person->>Browser: click Unban user on member detail
  Browser->>Browser: dialog "Unban name?" explains bookings stay cancelled and flamekeeping is not restored
  Person->>Browser: click Unban
  Browser->>Worker: unbanUserFn(userId)
  Worker->>Worker: checkAdminPermission(admin only)
  Worker->>D1: read target banned_at
  alt target not found
    Worker-->>Browser: error "User not found"
  else not banned
    Worker-->>Browser: error "User is not banned"
  else banned
    Worker->>D1: clear banned_at, ban_reason, banned_by
    Worker->>Telegram: club channel log "User unbanned by admin" with link
    Worker-->>Browser: success
    Browser->>Browser: invalidate all queries and the router
    Browser-->>Person: toast "name was unbanned"
  end
  Browser-->>Person: on error toast with the message or "Failed to unban user"
```

## Settings, club code, test email and broadcast

Settings and club code live on the dashboard Settings tab. The test email button and Broadcast Message item are in the dashboard header and are shown to admins only.

```mermaid
sequenceDiagram
  autonumber
  actor Person as Admin or Manager
  participant Browser
  participant Worker
  participant D1
  participant Gmail
  participant Telegram

  Person->>Browser: edit note, calendar id, opening and closing time then Save Settings
  Browser->>Browser: check both times set and start before end
  alt times invalid
    Browser-->>Person: inline message "Both operating hours times are required" or "Start time must be before end time"
  else valid
    Browser->>Worker: updateSettingsFn(globalBookingNote, birthdaysCalendarId, operatingHoursStart, operatingHoursEnd)
    Worker->>Worker: checkAdminPermission(admin or manager)
    alt start not before end
      Worker-->>Browser: error "Operating hours start must be before end time"
    else settings row missing
      Worker->>D1: insert settings global with the note and hours
    else row exists
      Worker->>D1: update provided fields and updated_at
    end
    Worker-->>Browser: settings row
    Browser->>Browser: invalidate prefixes admin-dashboard and bookings
    Browser-->>Person: toast "Settings updated successfully"
  end
  Browser-->>Person: on error toast with the message or "Failed to update settings"

  Person->>Browser: click Copy on the club code card
  Browser-->>Person: toast "Club code copied" or "Could not copy the club code"
  Person->>Browser: click Rotate
  Browser->>Worker: rotateClubCodeFn() (admin only)
  Worker->>D1: upsert settings global with a new generated club_code
  Worker-->>Browser: new code
  Browser->>Browser: write new code into the club-code query
  Browser-->>Person: toast "Club code rotated"
  Browser-->>Person: on error toast with the message or "Failed to rotate club code"

  Person->>Browser: click Send test email
  Browser->>Worker: sendTestEmailFn() (admin only)
  Worker->>Gmail: send email to the admin's own address (master token)
  alt Gmail send fails
    Worker-->>Browser: error "Failed to send test email. Check the server logs."
    Browser-->>Person: toast with that message
  else sent
    Worker-->>Browser: sentTo
    Browser-->>Person: toast "Test email sent to address"
  end

  Person->>Browser: Quick Actions then Broadcast Message
  Browser->>Browser: compose step, Next is enabled for 1 to 4000 characters
  Browser->>Browser: confirm step shows preview and "It cannot be undone."
  Person->>Browser: click Send Broadcast
  loop until done, 20 recipients per call
    Browser->>Worker: broadcastTelegramMessageFn(message, offset, limit 20)
    Worker->>Worker: checkAdminPermission(admin only)
    Worker->>D1: read all users, newest first
    alt no user has a linked chat
      Worker-->>Browser: done with 0 sent
    else
      Worker->>Telegram: sendMessage to each chat in the slice, message plus signature line with recipient name
      Telegram-->>Worker: per message success or failure, counted not retried
      opt this call finished the list
        Worker->>Telegram: club channel "Broadcast sent to n user(s)" plus ", f failed" if any
      end
      Worker-->>Browser: total, linked, sent, failed, skipped, offset, done
    end
    Browser->>Browser: progress bar updates, next offset is offset plus sent plus failed
  end
  alt every call succeeded
    Browser-->>Person: Broadcast Complete with Sent, Failed, Linked accounts, Skipped (no link)
  else a call throws
    Browser-->>Person: toast "Broadcast failed" and back to the confirm step
  end
```

## Exporting users and albums to CSV

Exports are built in the browser from the full list the server returns, not just the visible page.

```mermaid
sequenceDiagram
  autonumber
  actor Person as Admin or Manager
  participant Browser
  participant Worker
  participant D1

  Person->>Browser: Export Users on the Members list or in dashboard Quick Actions
  Browser->>Browser: dialog lists 15 columns all ticked
  Person->>Browser: untick columns and click Download CSV
  alt no column ticked
    Browser-->>Person: toast "Select at least one column to export"
  else
    Browser->>Browser: reuse cached export if the same filters were already fetched
    Browser->>Worker: exportUsersFn(role, status, clearanceLevel, search)
    Worker->>Worker: checkAdminPermission(admin or manager)
    Worker->>D1: all matching users ordered by first name, no paging
    Worker-->>Browser: users
    Browser->>Browser: build users-export.csv and download it
    Browser-->>Person: toast "Exported n user(s)" and dialog closes
  end
  Browser-->>Person: on error toast "Failed to export users"

  Person->>Browser: Export Albums on the admin albums page
  Browser->>Browser: dialog lists 7 columns all ticked
  Person->>Browser: click Download CSV
  Browser->>Worker: exportAlbumsFn()
  Worker->>Worker: checkAdminPermission(admin or manager)
  Worker->>D1: all albums not deleted with owner
  Worker->>D1: all album co-authors with name, email and Telegram
  Worker-->>Browser: albums with authors and album link
  Browser->>Browser: build albums-export.csv and download it
  Browser-->>Person: toast "Exported n album(s)" and dialog closes
  Browser-->>Person: on error toast "Failed to export albums"
```

## Birthdays page and birthday calendar

The calendar holds one yearly all-day event per Active or Board member with a readable birthday. The same sync also runs after a status change by an admin, after a member edits their birthday on their profile, and after onboarding (see the sign-up and onboarding scenario file).

```mermaid
sequenceDiagram
  autonumber
  actor Person as Admin or Manager
  participant Browser
  participant Worker
  participant D1
  participant Calendar

  Person->>Browser: click Sync to Calendar on the Birthdays page
  Browser->>Worker: syncBirthdaysToCalendarFn()
  Worker->>Worker: checkAdminPermission(admin or manager)
  Worker->>D1: read settings.birthdays_calendar_id (empty falls back to the built-in calendar)
  Worker->>D1: users with status Active or Board and a birthday
  Worker->>Calendar: list all events on the birthdays calendar (master token, up to 2500)
  loop each wanted member
    alt no event for the member
      Worker->>Calendar: create yearly all-day event
    else event date differs
      Worker->>Calendar: update the event
    end
    Note over Worker,Calendar: a failed event is logged and counted as skipped
  end
  loop each event whose member is no longer wanted
    Worker->>Calendar: delete the event
  end
  Note over Worker: birthdays that cannot be read are counted as skipped
  Worker-->>Browser: created, updated, deleted, skipped
  Browser->>Browser: invalidate the router
  Browser-->>Person: toast "Calendar synced: c created, u updated, d deleted"
  Browser-->>Person: on error toast with the message or "Failed to sync birthdays to the calendar"

  Person->>Browser: member edits their birthday and saves on the profile page
  Browser->>Worker: updateUserProfileFn(firstName, lastName, instagramUsername, birthday, major, graduationYear, nuId, image)
  Worker->>D1: update only the provided fields of the caller
  alt caller not signed in
    Worker-->>Browser: error "Unauthorized"
  else nothing provided
    Worker-->>Browser: error "No valid fields provided for update"
  else saved
    opt birthday was provided
      Worker->>Calendar: same reconcile as above, errors only logged
    end
    Worker-->>Browser: updated user
    Browser-->>Person: toast "Profile updated successfully"
  end
  Browser-->>Person: on error toast with the message or "Failed to update profile"

  Note over Browser,Worker: Every member in the signed-in app checks for a birthday today
  Browser->>Worker: getBirthdayWishMessageFn()
  Worker->>D1: Active or Board members with a birthday and wants_birthday_congratulation true
  alt not signed in or nobody has a birthday today
    Worker-->>Browser: null and nothing is shown
  else
    Worker-->>Browser: "Today is the birthday of names. Happy Birthday!"
    Browser-->>Person: Happy Birthday dialog or drawer, shown once per browser session
  end
```

## Managing equipment categories

The categories page under Admin lists every category with its equipment count. All category functions allow admins and managers.

```mermaid
sequenceDiagram
  autonumber
  actor Person as Admin or Manager
  participant Browser
  participant Worker
  participant D1

  Person->>Browser: click add, fill name, description, sort order and save
  Browser->>Worker: createCategoryFn(name, description, sortOrder)
  Worker->>Worker: checkAdminPermission(admin or manager)
  Worker->>D1: look up a category with the same name
  alt name exists
    Worker-->>Browser: error "Category name already exists"
  else
    Worker->>D1: insert category
    Worker-->>Browser: categoryId
    Browser->>Browser: invalidate the router
    Browser-->>Person: toast "Category created successfully"
  end
  Browser-->>Person: on error toast with the message or "Failed to create category"

  Person->>Browser: edit a category and save
  Browser->>Worker: updateCategoryFn(categoryId, name, description, sortOrder)
  Worker->>D1: read the category and any other category with the new name
  alt category missing
    Worker-->>Browser: error "Category not found"
    Browser-->>Person: toast "Category not found"
  else another category has that name
    Worker-->>Browser: error "Category name already exists"
  else
    Worker->>D1: update category
    Worker-->>Browser: success
    Browser-->>Person: toast "Category updated successfully"
  end

  Person->>Browser: delete a category and confirm
  Browser->>Worker: deleteCategoryFn(categoryId)
  Worker->>D1: read the category
  alt missing
    Worker-->>Browser: error "Category not found"
    Browser-->>Person: toast "Category not found" and dialog closes
  else
    Worker->>D1: find or create category Uncategorized with sort order 999
    Worker->>D1: move all its equipment to Uncategorized
    Worker->>D1: delete the category
    Worker-->>Browser: success
    Browser-->>Person: toast naming the category and how many items moved to "Uncategorized"
  end

  Person->>Browser: drag a category row to a new place
  Browser->>Browser: reorder the rows locally at once
  Browser->>Worker: updateCategorySortOrderFn(categoryUpdates with sort_order 0, 1, 2 and so on)
  loop each category
    Worker->>D1: set sort_order
  end
  alt saved
    Worker-->>Browser: success
    Browser-->>Person: toast "Category order updated successfully"
  else failed
    Browser->>Browser: put the rows back in the old order
    Browser-->>Person: toast "Failed to update category order"
  end
```
