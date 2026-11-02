# Bookings

How a booking lives on the website for members and for admins or managers: finding free equipment, creating, editing, extending, starting pickup, cancelling, adding or cancelling single items, the admin booking pages, and the operating-hours settings. Returns happen only in Telegram. Automatic cancel, overdue and reminders are cron jobs.

## Data

Equipment availability is never stored in D1. It is read live from one Google Calendar per equipment (`equipment.gcal_id`). Every Calendar call uses the club master Google token. The token is cached in Worker memory for 50 minutes and is refreshed from Google OAuth when the cache is empty or old. Rate limits use Cloudflare's rate limit binding (not KV and not D1).

```mermaid
erDiagram
  user ||--o{ booking : makes
  booking ||--|{ booking_item : contains
  equipment ||--o{ booking_item : "is booked as"
  category ||--o{ equipment : groups

  user {
    text id PK
    text role "user, manager, admin"
    boolean isMember "only members can book"
    integer overdueCount "lowered by one when an extension clears overdue"
    text telegramChatId "target of the pickup note"
  }
  booking {
    integer id PK
    text userId FK
    timestamp startTime "booked start"
    timestamp endTime "booked finish, moved by extend"
    text status "booked, active, returned, cancelled, overdue, partially_returned"
    text userEventDetails "member notes"
    timestamp startedAt "actual pickup time"
    timestamp updatedAt
  }
  booking_item {
    integer id PK
    integer bookingId FK
    integer equipmentId FK
    text status "booked, active, returned, cancelled, overdue"
    text gcal_event_id "Calendar event in the equipment calendar"
  }
  equipment {
    integer id PK
    integer categoryId FK
    text modelName
    text gcal_id "Google Calendar id of this item"
  }
  category {
    integer id PK
    text name
  }
  settings {
    text id PK "always global"
    text globalBookingNote "sent to the member at pickup"
    integer operatingHoursStart "minutes since midnight, default 0"
    integer operatingHoursEnd "minutes since midnight, default 1439"
  }
```

## Loading pages and checking availability

Opening the equipment page, the new booking page, the booking lists and the booking detail pages. All times are club time (Asia/Almaty, UTC+5). A booking is one single day, starts at least 1 hour from now, is at most 48 hours long and starts within 60 days.

```mermaid
sequenceDiagram
  autonumber
  participant Member as Member
  participant Admin as Admin or manager
  participant Browser
  participant Worker
  participant D1
  participant Calendar

  Member->>Browser: open Equipment page
  Browser->>Worker: getBookingSettingsFn()
  Worker->>D1: read settings row global
  opt no settings row yet
    Worker->>D1: insert settings global, note empty, hours 0 to 1439
  end
  Worker-->>Browser: operating hours and note (cached 5 minutes in the browser)
  Note over Browser: default window = next 30 minute boundary at least 1 hour from now,<br/>inside operating hours, else first slot of the next day
  Browser->>Worker: checkMultipleCalendarsFreeBusy(calendar ids, window)
  Note over Browser: browser splits into chunks of 40 calendars
  Worker->>Worker: requireAuthenticatedUser()
  Worker->>Calendar: freeBusy (master token), 15 calendars per request
  Calendar-->>Worker: busy periods per calendar
  Worker-->>Browser: busy map
  Note over Browser: any busy period in the window marks the card busy
  Browser->>Worker: checkCalendarFreeBusy(calendar id, window)
  Note over Browser: equipment detail badge, a failed check also shows as busy

  Member->>Browser: open New Booking page with picked equipment
  Browser->>Worker: getTelegramBotUsernameFn()
  Browser->>Worker: checkCalendarFreeBusy or checkMultipleCalendarsFreeBusy (selected date, 00:00 to 23:59)
  Worker->>Calendar: freeBusy (master token)
  Calendar-->>Browser: busy periods
  Note over Browser: slots only inside operating hours<br/>slot starting within 1 hour of now is disabled<br/>slot overlapping a busy period is disabled<br/>picking slots always fills the range between first and last
  alt free/busy fails
    Browser-->>Member: toast "Failed to load availability"
  end
  Browser->>Worker: getCalendarEvents(calendar id, view range, max 250)
  Worker->>Calendar: list events (master token)
  Calendar-->>Browser: events for the month, week or day view
  alt events fail
    Browser-->>Member: toast "Failed to load calendar events"
  end

  Member->>Browser: open My Bookings
  Browser->>Worker: getUserBookingsFn(filters, page, sort)
  Worker->>D1: count and page of own bookings with items, equipment, category
  Worker-->>Browser: page of bookings (no session gives an empty list)
  Note over Browser: default filter hides returned and cancelled, 50 per page, at most 100
  Browser->>Worker: getTelegramBotUsernameFn()

  Member->>Browser: open one booking or its edit page
  Browser->>Worker: getBookingByIdFn(bookingId)
  Worker->>D1: read booking and items
  alt booking missing or owned by someone else
    Worker-->>Browser: null
    Browser-->>Member: error page "Booking not found"
  end

  Admin->>Browser: open Manage Bookings
  Browser->>Worker: getAdminBookingsFn(filters, page, sort by startTime, endTime, status, createdAt)
  Worker->>Worker: checkAdminPermission admin or manager
  alt not admin or manager
    Worker-->>Browser: error "Insufficient permissions"
  end
  Worker->>D1: page of all bookings with user, items, equipment
  Note over Browser: banner counts active or partially returned bookings whose end time passed
  Admin->>Browser: open one booking or its edit page
  Browser->>Worker: getAdminBookingByIdFn(bookingId)
  Worker->>D1: read booking, user and items
```

## Creating a booking

The member picks equipment on the Equipment page, taps Book, then picks a date and slots on New Booking. Event details are required in the confirm dialog (the Confirm Booking button stays disabled while the notes are empty).

```mermaid
sequenceDiagram
  autonumber
  participant Member
  participant Browser
  participant Worker
  participant D1
  participant Calendar
  participant Telegram

  Member->>Browser: tap "Book Equipment", then fill notes, tap "Confirm Booking"
  Browser->>Worker: createBookingFn(equipmentIds, startTime, endTime, notes)
  Note over Worker: at most 10 items, notes at most 500 chars, duplicates removed
  alt finish not after start
    Worker-->>Browser: error "Invalid booking times"
  else start under 1 hour from now
    Worker-->>Browser: error "Bookings must start at least 1 hour from now. Please select a later time slot."
  else longer than 48 hours
    Worker-->>Browser: error "Bookings cannot be longer than 48 hours."
  else start more than 60 days away
    Worker-->>Browser: error "Bookings must start within 60 days."
  end
  Worker->>Worker: resolve session
  alt no session
    Worker-->>Browser: error "Not authenticated"
  end
  Worker->>D1: assertAccess canBook (user.isMember)
  alt not a member
    Worker-->>Browser: error "Only club members can book equipment"
  end
  Worker->>Worker: rate limit rl_create_booking, 10 per 60 seconds per user
  alt too many requests
    Worker-->>Browser: error "Too many booking requests. Please try again shortly."
  end
  Worker->>D1: read gcal_id of each equipment
  alt equipment has no calendar
    Worker-->>Browser: error "No calendar configured for equipment (id)"
  end
  Worker->>Calendar: freeBusy for all calendars from booking start until finish (master token, 15 per request)
  alt any calendar has a busy period
    Worker-->>Browser: error "Requested time conflicts with existing booking(s)" with the conflicting equipment ids
    Browser-->>Member: toast "Time slot unavailable for:" followed by equipment names
  end
  Worker->>D1: insert booking, status booked, notes
  loop each equipment
    Worker->>Calendar: insert event "Model - Booking" in its calendar, no attendees, no emails (retry 3 times, waits 400 ms then 800 ms then 1200 ms)
    Worker->>D1: insert booking_item, status booked, gcal_event_id
  end
  alt any step in the loop fails
    Worker->>Calendar: delete the events already created
    Worker->>D1: delete the created items and the booking
    Worker-->>Browser: the original error
    Browser-->>Member: toast with the error message, or "Failed to create booking"
  end
  Worker->>Telegram: logBookingActivityById booked (club channel, see 04-telegram-bot.md)
  Note over Worker,Telegram: a failure to log is ignored
  Worker-->>Browser: bookingId
  Browser-->>Member: toast "Booking created successfully! Booking ID: " with the id
  Browser->>Browser: clear selected slots, notes and saved equipment selection
  Browser->>Browser: navigate to the booking detail page
```

## Editing a booking

Only bookings with status booked show the edit screen. Members save from `/bookings/:id/edit`, admins and managers from `/admin/bookings/:id/edit`. The slot picker starts on the booking's current day and slots, and does not treat the booking's own calendar event as busy.

```mermaid
sequenceDiagram
  autonumber
  participant Member
  participant Admin as Admin or manager
  participant Browser
  participant Worker
  participant D1
  participant Calendar
  participant Telegram

  Member->>Browser: change slots and notes, tap "Save Changes"
  Note over Browser: Save is disabled with no slot selected
  Browser->>Worker: updateBookingFn(bookingId, startTime, endTime, notes)
  Worker->>Worker: resolve session
  alt no session
    Worker-->>Browser: error "Not authenticated"
  end
  Worker->>D1: read booking and items with calendars
  alt booking missing
    Worker-->>Browser: error "Booking not found"
  else booking owned by someone else
    Worker-->>Browser: error "Unauthorized"
  else booking cancelled
    Worker-->>Browser: error "Cannot update a cancelled booking"
  end
  alt new start under 1 hour from now
    Worker-->>Browser: error "Bookings must start at least 1 hour from now. Please select a later time slot."
  end
  loop each item
    Worker->>Calendar: freeBusy over the new time window (master token)
    Worker->>Worker: ignore busy periods fully inside the booking's current period
    alt other busy period remains
      Worker-->>Browser: error "Requested time conflicts with existing booking for (equipment name)"
    end
  end
  Worker->>D1: update booking start, finish, notes
  Worker->>Telegram: logBookingActivityById edited with previous values (see 04-telegram-bot.md)
  loop each item with an event
    Worker->>Calendar: patch event "Model - Booking" with new times and description (failure only logged)
  end
  Worker-->>Browser: success
  Browser-->>Member: toast "Booking updated successfully!"
  Browser->>Browser: after 1.5 seconds go to My Bookings
  opt any error above
    Browser-->>Member: toast with the error message, or "Failed to update booking. Please try again."
  end

  Admin->>Browser: change slots and notes, tap "Save Changes"
  Note over Browser: times are sent only if they differ from the current ones
  Browser->>Worker: updateBookingStatusAdminFn(bookingId, notes, startTime, endTime)
  Worker->>Worker: checkAdminPermission admin or manager
  alt not allowed
    Worker-->>Browser: error "Unauthorized: No session" or "Insufficient permissions"
  end
  Worker->>D1: read booking, user and items
  alt booking missing
    Worker-->>Browser: error "Booking not found"
  else booking has no items
    Worker-->>Browser: error "Booking has no items"
  end
  opt times changed
    loop each item
      Worker->>Calendar: freeBusy over the new time window (master token)
      alt another busy period remains
        Worker-->>Browser: error "Requested time conflicts with existing booking for (equipment name)"
      end
    end
  end
  Worker->>D1: update notes, and times if changed
  Worker->>D1: recomputeBookingStatus from item statuses
  Worker->>Telegram: logBookingActivityById edited with admin name (see 04-telegram-bot.md)
  loop each item with an event
    Worker->>Calendar: patch event "Model - Booking (STATUS)" (failure only logged)
  end
  Worker-->>Browser: success
  Browser-->>Admin: green box "Booking updated successfully! Database and calendar have been synchronized."
  Browser->>Browser: after 2 seconds go to Manage Bookings
  opt error
    Browser-->>Admin: red box with the message, or "Failed to update booking. Please try again."
  end
```

## Adding and cancelling single items

"Add More" on a booked booking opens the Equipment page in add-to-booking mode. Items already in the booking are marked, and availability is checked for the booking's own time window. Cancel item is shown only while the booking is booked. Both work for the owner, and for admins and managers.

```mermaid
sequenceDiagram
  autonumber
  participant Member as Member or admin
  participant Browser
  participant Worker
  participant D1
  participant Calendar
  participant Telegram

  Member->>Browser: tap "Add More" on a booking
  Browser->>Worker: getBookingItemEquipmentIdsFn(bookingId)
  Browser->>Worker: getBookingWindowFn(bookingId)
  Worker->>D1: check owner, or admin or manager, and status booked
  alt not owner and not admin or manager
    Worker-->>Browser: error "Insufficient permissions"
  else booking not booked
    Worker-->>Browser: error "Items can only be added or cancelled while the booking has not started"
  end
  Worker-->>Browser: equipment ids and the booking start and finish
  Member->>Browser: select equipment, tap book
  Browser->>Worker: checkMultipleCalendarsFreeBusy(calendar ids, booking window)
  Worker->>Calendar: freeBusy (master token)
  alt a selected item is busy
    Browser-->>Member: toast "(names) is not available during this booking's time window" (are for several)
  end
  Browser->>Browser: return to the booking page with equipmentIds in the address
  Browser->>Worker: addBookingItemsFn(bookingId, equipmentIds)
  Worker->>Worker: rate limit rl_add_booking_items, 10 per 60 seconds per user
  alt too many requests
    Worker-->>Browser: error "Too many requests. Please try again shortly."
  end
  Worker->>D1: check access again, read booking and its existing items
  alt every selected item is already in the booking
    Worker-->>Browser: error "Selected equipment is already part of this booking"
  end
  Worker->>D1: read gcal_id of the new items
  alt an item has no calendar
    Worker-->>Browser: error "No calendar configured for equipment (id)"
  end
  Worker->>Calendar: freeBusy over the booking window (master token)
  alt any busy period
    Worker-->>Browser: error "Requested time conflicts with existing booking(s) for (names)"
  end
  loop each new item
    Worker->>Calendar: insert event "Model - Booking" (retry 3 times)
    Worker->>D1: insert booking_item, status booked
  end
  alt a step fails
    Worker->>Calendar: delete the events created in this call
    Worker->>D1: delete the items created in this call
    Worker-->>Browser: the original error
  end
  Worker->>D1: set booking updatedAt
  Worker->>Telegram: logBookingActivityById items_added (see 04-telegram-bot.md)
  Worker-->>Browser: success and number added
  Browser-->>Member: toast "Added N items to this booking" (adds ", M already included" when some were skipped)
  Browser->>Browser: invalidate bookings queries, reload the page, clear the address parameter
  opt error
    Browser-->>Member: toast with the error message, or "Failed to add equipment to this booking"
    Browser->>Browser: clear the address parameter
  end

  Member->>Browser: tap "Cancel item", then "Cancel Item" in the dialog
  Browser->>Worker: cancelBookingItemFn(bookingId, itemId)
  Worker->>D1: check owner or admin or manager, and status booked
  Worker->>D1: set item status = cancelled
  Worker->>D1: recomputeBookingStatus (all items cancelled gives booking cancelled)
  Worker->>Calendar: delete the item's event (failure only logged)
  alt item already cancelled or returned
    Worker-->>Browser: error "Item is already cancelled or returned"
  end
  Worker->>Telegram: logBookingActivityById cancelled (see 04-telegram-bot.md)
  Worker-->>Browser: success
  Browser-->>Member: toast "Item cancelled successfully"
  Browser->>Browser: invalidate bookings queries and reload the page
  opt error
    Browser-->>Member: toast with the error message, or "Failed to cancel item"
  end
```

## Extending a booking by 30 minutes

"Add 30 min" shows for booked, active, partially returned and overdue bookings, on list rows, detail pages and edit pages, for the owner and for admins and managers.

```mermaid
sequenceDiagram
  autonumber
  participant Member as Member or admin
  participant Browser
  participant Worker
  participant D1
  participant Calendar
  participant Telegram

  Member->>Browser: tap "Add 30 min"
  Note over Browser: uses cached operating hours closing time
  alt booking finish plus 30 minutes passes midnight
    Browser-->>Member: dialog "This booking can't be extended" (would cross midnight)
  else booking finish plus 30 minutes passes closing time
    Browser-->>Member: dialog "This booking can't be extended" (past closing time)
  else allowed
    Browser-->>Member: dialog "Extend this booking by 30 minutes?"
    Member->>Browser: tap "Extend booking"
  end
  Browser->>Worker: extendBookingByThirtyMinutesFn(bookingId)
  Worker->>Worker: resolve session
  alt no session
    Worker-->>Browser: error "Not authenticated"
  end
  Worker->>D1: read booking, owner and items
  alt booking missing
    Worker-->>Browser: error "Booking not found"
  else not the owner and not admin or manager
    Worker-->>Browser: error "Insufficient permissions"
  else status cancelled or returned
    Worker-->>Browser: error "A booking with status (status) cannot be extended"
  end
  Worker->>D1: read operating hours closing time
  alt past midnight
    Worker-->>Browser: error "This booking cannot be extended past midnight"
  else past closing time
    Worker-->>Browser: error "This booking cannot be extended beyond the club operating hours"
  end
  alt no item is left that is not cancelled or returned
    Worker-->>Browser: error "Booking has no items that can be extended"
  end
  Worker->>Calendar: freeBusy from current finish to finish plus 30 minutes for open items (master token)
  alt any open item is busy
    Worker-->>Browser: error "Cannot extend the booking: (names) is not available for the extra 30 minutes"
  end
  Worker->>D1: set booking endTime = endTime plus 30 minutes
  opt new finish is still in the future and some items are overdue
    Worker->>D1: set overdue items status = active
    Worker->>D1: set user.overdueCount down by 1 (never below 0)
  end
  Worker->>D1: recomputeBookingStatus
  loop each open item with an event
    Worker->>Calendar: patch event with new finish, start = actual pickup or booked start (failure only logged)
  end
  Worker->>Telegram: logBookingActivityById extended, 30 minutes (see 04-telegram-bot.md)
  Worker-->>Browser: success, new end time, undidOverdue
  alt overdue was cleared
    Browser-->>Member: toast "Booking extended by 30 minutes and the overdue status was reset"
  else normal
    Browser-->>Member: toast "Booking extended by 30 minutes"
  end
  Browser->>Browser: invalidate bookings queries and reload the page
  opt error
    Browser-->>Member: toast with the error message, or "Failed to extend the booking"
  end
```

## Starting pickup and returning

"Start Pickup" is on the booking detail page of the owner only. The button shows only while the booking is booked, not started, and now is within 15 minutes before or after the start time. Admins have no start button. Returns are not on the website. The "Return" links open the Telegram bot.

```mermaid
sequenceDiagram
  autonumber
  participant Member
  participant Browser
  participant Worker
  participant D1
  participant Calendar
  participant Telegram

  Member->>Browser: tap "Start Pickup", then "Start Booking"
  Browser->>Worker: startBookingFn(bookingId)
  Worker->>Worker: resolve session
  alt no session
    Worker-->>Browser: error "Not authenticated"
  end
  Worker->>D1: read booking owner
  alt booking missing
    Worker-->>Browser: error "Booking not found"
  else owned by someone else
    Worker-->>Browser: error "You can only start your own bookings"
  end
  Worker->>D1: startBooking: read booking, user and items
  alt status is not booked
    Worker-->>Browser: error "Booking cannot be started from status (status)"
  else startedAt already set
    Worker-->>Browser: error "Booking has already been started"
  else more than 15 minutes before start
    Worker-->>Browser: error "Booking can be started up to 15 minutes before the start time"
  else more than 15 minutes after start
    Worker-->>Browser: error "Booking start window has passed, the booking will be auto-cancelled"
  else every item cancelled or returned
    Worker-->>Browser: error "Booking has no items that can be started"
  end
  Worker->>D1: set booking startedAt = now
  Worker->>D1: set open items status = active
  Worker->>D1: recomputeBookingStatus
  loop each open item with an event
    Worker->>Calendar: patch event "Model (ACTIVE)", start = now, finish = booked finish (failure only logged)
  end
  Worker->>Telegram: logBookingActivityById picked_up (see 04-telegram-bot.md)
  opt settings.globalBookingNote not empty and member has a Telegram chat
    Worker->>Telegram: send the note to the member's chat (see 04-telegram-bot.md, failure ignored)
  end
  Worker-->>Browser: success
  Browser-->>Member: toast "Booking started successfully"
  Browser->>Browser: invalidate bookings queries and reload the page
  opt error
    Browser-->>Member: toast with the error message, or "Failed to start booking"
  end
  Note over Worker: getStartableBookingsFn(): lists the signed-in member's booked,<br/>unstarted bookings whose start window is open. No page calls it.
  Note over Worker,Telegram: the same startBooking logic is run by the Telegram Start Booking command, see 04-telegram-bot.md

  Member->>Browser: tap "Return booking" or "Return" on an item
  Note over Browser: shown for active, partially returned and overdue bookings
  Browser->>Telegram: open the bot link in a new tab
  Note over Member,Telegram: member sends /return_equipment, see 04-telegram-bot.md
  Note over Worker: a booking not started by pickup time is cancelled by the 5-minute cron, see 08-cron-overview-and-bookings.md
```

## Cancelling and deleting bookings

Members can cancel only their own booked bookings. Admins and managers can cancel any booked booking. Once a booking has started it can only be returned through Telegram.

```mermaid
sequenceDiagram
  autonumber
  participant Member
  participant Admin as Admin or manager
  participant Browser
  participant Worker
  participant D1
  participant Calendar
  participant Telegram

  Member->>Browser: tap "Cancel booking" on a row, the detail page or the edit page
  Browser-->>Member: dialog "Cancel Booking?" or "Cancel Booking" (cannot be undone)
  Member->>Browser: confirm "Yes, cancel booking" or "Cancel Booking"
  Browser->>Worker: cancelBookingFn(bookingId)
  Worker->>Worker: resolve session
  alt no session
    Worker-->>Browser: error "Not authenticated"
  end
  Worker->>D1: read booking
  alt booking missing
    Worker-->>Browser: error "Booking not found"
  else owned by someone else
    Worker-->>Browser: error "Unauthorized"
  else already cancelled
    Worker-->>Browser: error "Booking is already cancelled"
  else status not booked
    Worker-->>Browser: error "Only upcoming bookings can be cancelled. This booking has already started and must be returned through the Telegram bot."
  end
  Worker->>D1: set all items status = cancelled
  Worker->>D1: recomputeBookingStatus (failure only logged)
  Worker->>Telegram: logBookingActivityById cancelled (see 04-telegram-bot.md)
  loop each item with an event
    Worker->>Calendar: delete event (failure only logged)
  end
  Worker-->>Browser: success
  Browser-->>Member: toast "Booking cancelled successfully" (edit page: "Booking cancelled successfully!")
  Browser->>Browser: invalidate bookings queries (edit page goes to My Bookings after 1.5 seconds)
  opt error
    Browser-->>Member: toast with the error message, or "Failed to cancel booking"
  end

  Member->>Browser: tick several rows, tap "Cancel Selected", confirm
  Note over Browser: only booked rows count, others are skipped and the dialog says so
  Browser->>Worker: cancelBookingFn(bookingId) once per booked row, all at the same time
  alt at least one succeeded
    Browser-->>Member: toast "Cancelled N booking(s)"
    Browser->>Browser: clear selection, invalidate bookings queries
  end
  alt at least one failed
    Browser-->>Member: toast "Some bookings could not be cancelled" with "Failed to cancel N booking(s)."
  end

  Admin->>Browser: tap "Cancel booking" on a row or the edit page, optional reason, confirm
  Note over Browser: detail page and bulk cancel send no reason, the dialog sends "Booking cancelled by admin" when empty
  Browser->>Worker: updateBookingStatusAdminFn(bookingId, status cancelled, notes)
  Worker->>Worker: checkAdminPermission admin or manager
  Worker->>D1: read booking and items
  alt booking missing
    Worker-->>Browser: error "Booking not found"
  else status not booked
    Worker-->>Browser: error "Only upcoming bookings can be cancelled. This booking has already started and must be returned through the Telegram bot."
  else booking has no items
    Worker-->>Browser: error "Booking has no items"
  end
  Note over Worker: any status other than cancelled is refused with<br/>"Admins can only change a booking status to cancelled. Other statuses are set automatically."
  Worker->>D1: append "[Admin Note by (admin name)]: (reason)" to the member's notes
  Worker->>D1: set all items status = cancelled
  Worker->>D1: recomputeBookingStatus (failure only logged)
  Worker->>Telegram: logBookingActivityById cancelled with admin name and reason (see 04-telegram-bot.md)
  loop each item with an event
    Worker->>Calendar: delete event (failure only logged)
  end
  Worker-->>Browser: success
  alt from the list
    Browser->>Browser: invalidate bookings queries
  else from the edit page
    Browser->>Browser: go to Manage Bookings
  else from the detail page
    Browser-->>Admin: toast "Booking cancelled successfully" and reload
  end
  opt error
    Browser-->>Admin: list: toast with message, edit page: red box with message or "Failed to cancel booking. Please try again."
  end

  Note over Admin,Worker: deleteBookingAdminFn(bookingId) exists but no page calls it
  Admin->>Worker: deleteBookingAdminFn(bookingId)
  Worker->>Worker: checkAdminPermission admin or manager
  Worker->>D1: read items and check the booking exists
  alt booking missing
    Worker-->>Admin: error "Booking not found"
  end
  loop each item with an event
    Worker->>Calendar: delete event (failure only logged)
  end
  Worker->>Telegram: logBookingActivityById deleted with admin name (see 04-telegram-bot.md)
  Worker->>D1: delete booking, its items are deleted with it
  Worker-->>Admin: success
```

## Booking settings and operating hours

Admins and managers set the club's opening and closing time and the note sent to members at pickup. The hours limit which slots the picker offers, where "Add 30 min" stops, and the default window used for availability.

```mermaid
sequenceDiagram
  autonumber
  participant Admin as Admin or manager
  participant Browser
  participant Worker
  participant D1

  Admin->>Browser: open admin Dashboard, Settings tab
  Browser->>Worker: getSettingsFn()
  Worker->>Worker: checkAdminPermission admin or manager
  Worker->>D1: read settings global, create it with hours 0 to 1439 if missing
  Worker-->>Browser: settings without the club code
  Admin->>Browser: edit start time, closing time and note, tap save
  alt a time is empty
    Browser-->>Admin: message "Both operating hours times are required"
  else opening not before closing
    Browser-->>Admin: message "Start time must be before end time"
  end
  Browser->>Worker: updateSettingsFn(globalBookingNote, birthdaysCalendarId, operatingHoursStart, operatingHoursEnd)
  Worker->>Worker: checkAdminPermission admin or manager
  alt opening not before closing
    Worker-->>Browser: error "Operating hours start must be before end time"
  end
  Worker->>D1: update settings global (insert it if missing)
  Worker-->>Browser: updated settings
  Browser-->>Admin: toast "Settings updated successfully"
  Browser->>Browser: invalidate admin-dashboard and bookings queries
  opt error
    Browser-->>Admin: toast with the error message, or "Failed to update settings"
  end
  Note over Browser,Worker: members read the hours through getBookingSettingsFn(), see the first scenario
```
