# Telegram Bot

Everything a member does by chatting with the club bot: linking a Telegram account, listing bookings, picking up equipment, returning it with a photo, and cancelling. Telegram calls the webhook on every message. The bot also posts activity logs to the club channel.

## Data

Bot sessions live in KV under the key `session:{telegramChatId}` as JSON, with a 1 hour TTL (`expirationTtl` 3600). Every write refreshes the TTL. Fields: `step`, `userId`, `activeBookingIds`, `selectedBookingIds`, `selectedItemIds`, `startBookingId`, `cancelBookingId`, `pendingCancelItemIds`, `createdAt`. Steps: `awaiting_booking_selection`, `awaiting_item_selection`, `awaiting_photo`, `awaiting_start_selection`, `awaiting_start_confirm`, `awaiting_cancel_selection`, `awaiting_cancel_items`, `awaiting_cancel_confirm`. Return photos are never stored in R2 or D1. Only the Telegram `file_id` is forwarded to the club channel.

```mermaid
erDiagram
    user ||--o{ telegram_link_token : "gets link tokens"
    user ||--o{ booking : makes
    booking ||--o{ booking_item : contains
    equipment ||--o{ booking_item : "is booked as"
    user {
        text id PK
        text telegram_chat_id "set when linked"
        text telegram_username
        integer onboarding_complete
        text first_name
        text last_name
        text name
    }
    telegram_link_token {
        text token PK "random 32 hex chars"
        text user_id FK
        integer expires_at "10 minutes after creation"
    }
    booking {
        integer id PK
        text user_id FK
        integer start_time
        integer end_time
        text status "booked, active, returned, cancelled, overdue, partially_returned"
        integer started_at "actual pickup time"
        text user_event_details
    }
    booking_item {
        integer id PK
        integer booking_id FK
        integer equipment_id FK
        text status "booked, active, returned, cancelled, overdue"
        text gcal_event_id
        integer returned_at
    }
    equipment {
        integer id PK
        text model_name
        text gcal_id
    }
    settings {
        text id PK "global"
        text global_booking_note
    }
```

## Linking a Telegram account

The member creates the link on the web (onboarding step 2 or the profile page), then taps it in Telegram. The link is valid for 10 minutes. A valid unexpired token for the same user is reused instead of making a new one.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Browser
    participant Worker
    participant D1
    participant Telegram

    Member->>Browser: Onboarding step 2 or Profile page
    alt first onboarding visit
        Browser->>Worker: getTelegramLinkUrlFn()
        Worker->>D1: read user.telegram_chat_id
        alt already linked
            Worker-->>Browser: alreadyLinked true, no url
            Note over Browser: onboarding continues, see the onboarding scenario file
        else not linked
            Worker->>Worker: createTelegramLinkToken(userId)
            Worker->>D1: find unexpired telegram_link_token for user
            alt none found
                Worker->>D1: insert token, expires_at = now + 10 minutes
            end
            Worker-->>Browser: https://t.me/BOT?start=TOKEN
            Note over Browser: button "Open Telegram Bot" then<br/>"Waiting for Telegram..."
        end
    else profile page re-link
        Browser->>Worker: getTelegramUpdateLinkUrlFn()
        Worker->>Worker: createTelegramLinkToken(userId)
        Worker-->>Browser: bot link with token
    end
    Member->>Telegram: taps link, sends /start TOKEN
    Telegram->>Worker: POST /api/telegram (see webhook diagram)
    Worker->>Worker: handleStart(ctx)
    Worker->>D1: find token where token matches and expires_at is in the future
    alt token valid
        Worker->>D1: set user.telegram_chat_id, telegram_username, onboarding_complete = true
        Worker->>D1: delete the used token
        Worker->>Telegram: sendMessage "Telegram linked ✅" and remove keyboard
        Worker->>Telegram: showMainMenu: "📋 Main Menu" + "Choose an action below:" with 4 buttons
    else token missing or expired
        Worker->>D1: find user with this telegram_chat_id
        alt chat already linked
            Worker->>Telegram: showMainMenu
        else not linked
            Worker->>Telegram: sendMessage "Link expired or invalid."
        end
    else database error
        Worker->>Telegram: sendMessage "Error linking account. Please try again."
    end
    Note over Browser: the onboarding page keeps waiting and<br/>continues once the account shows as linked
    Member->>Telegram: bare /start later
    Worker->>D1: find user by telegram_chat_id
    alt linked
        Worker->>Telegram: showMainMenu
    else not linked
        Worker->>Telegram: "Welcome! Please use the link from the web app to connect your account." and remove keyboard
    end
```

## Webhook, checks and message routing

Telegram sends every update to the webhook. The bot is driven by a persistent reply keyboard, so each tap arrives as a plain text message. There are no inline buttons: an update that is a `callback_query` is rate limited and then ignored. Every 5-minute cron run also re-registers the bot's command list.

```mermaid
sequenceDiagram
    autonumber
    participant Telegram
    participant Worker
    participant KV
    participant D1
    participant Cron

    Telegram->>Worker: POST /api/telegram with header x-telegram-bot-api-secret-token
    alt TELEGRAM_WEBHOOK_SECRET not configured
        Worker-->>Telegram: 500 "Misconfigured"
    else header does not match the secret
        Worker-->>Telegram: 401 "Unauthorized"
    end
    Worker->>Worker: parse the update JSON
    opt update has a chat id
        Worker->>Worker: rateLimit rl_telegram_webhook, key chat:ID, 30 per 60 seconds
        alt over the limit
            Worker-->>Telegram: 429 "Too Many Requests"
            Note over Worker: no reply is sent to the member
        end
    end
    alt message has a photo
        Worker->>Worker: handlePhoto(ctx), see return diagram
    else message has text
        alt text starts with /start_booking, or is "▶️ Start Booking" or "Start Booking"
            Worker->>Worker: handleStartBooking(ctx), see start diagram
        else text starts with /return_equipment, or is "↩️ Return Equipment" or "End Booking"
            Worker->>Worker: handleEndBooking(ctx), see return diagram
        else text starts with /my_bookings, or is "📋 My Bookings" or "My Bookings"
            Worker->>Worker: handleListBookings(ctx), see my bookings diagram
        else text starts with /cancel_booking, or is "❌ Cancel Booking" or "Cancel Booking"
            Worker->>Worker: handleCancelBooking(ctx), see cancel diagram
        else text starts with /start
            Worker->>Worker: handleStart(ctx), see linking diagram
        else text is "🏠 Main Menu"
            Worker->>Telegram: showMainMenu: "📋 Main Menu" + "Choose an action below:" and 4 buttons
        else anything else
            Worker->>Worker: handleFlowText(ctx)
            Worker->>KV: get session:chatId
            alt no session or no step
                Worker->>Telegram: showMainMenu
            else session has a step
                Note over Worker: routed by step, see start, return and cancel diagrams
            end
        end
    end
    Worker-->>Telegram: 200 "OK"
    alt any uncaught error
        Worker-->>Telegram: 500 "Internal Server Error"
    end

    Cron->>Worker: every 5 minutes, configureTelegramBot(env, budget)
    Note over Worker: skipped if no bot token or budget has no room, costs 1 budget unit
    Worker->>Telegram: setMyCommands: start = "Open the main menu"
```

The four menu buttons are `📋 My Bookings`, `▶️ Start Booking`, `↩️ Return Equipment` and `❌ Cancel Booking`.

## Viewing my bookings

Triggered by `/my_bookings` or the `📋 My Bookings` button. Shows bookings that have items still `booked`, `active` or `overdue`. Times are shown in Asia/Almaty.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Telegram
    participant Worker
    participant D1

    Member->>Telegram: taps "📋 My Bookings"
    Telegram->>Worker: webhook, text routed to handleListBookings(ctx)
    Worker->>D1: find user by telegram_chat_id
    alt chat not linked
        Worker->>Telegram: "Please link your account via /start first." and remove keyboard
    else linked
        Worker->>D1: bookings of the user joined with items and equipment, items booked or active or overdue
        alt none
            Worker->>Telegram: "You have no active or upcoming bookings." with "🏠 Main Menu" button
        else some
            Worker->>Telegram: "Your bookings:" then per booking a line "Upcoming - Booking N", the date and time range, and each item as "- Name (item status)"
            Note over Worker: label is Active, Overdue, Partially Returned or Upcoming from the booking status
        end
    end
    opt database error
        Worker->>Telegram: "Error fetching bookings. Please try again."
    end
```

## Starting a booking (picking up equipment)

Only bookings with status `booked`, no `started_at`, and a start time within 15 minutes before or after now are offered. The member picks a booking, then confirms.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Telegram
    participant Worker
    participant KV
    participant D1
    participant Calendar

    Member->>Telegram: taps "▶️ Start Booking"
    Telegram->>Worker: webhook, handleStartBooking(ctx)
    Worker->>D1: find user by telegram_chat_id
    alt chat not linked
        Worker->>Telegram: "Please link your account via /start first." and remove keyboard
    else linked
        Worker->>Worker: listStartableBookings(database, userId)
        Worker->>D1: user bookings with status booked and started_at empty, kept if start within 15 min either side of now
        alt none startable
            Worker->>Telegram: "You have no bookings to start right now." plus "Your booking can be started up to 15 minutes before its start time, and up to 15 minutes after." and "🏠 Main Menu"
        else some
            Worker->>KV: put session step awaiting_start_selection, TTL 1 hour
            Worker->>Telegram: "Select which booking to start:" with a button per booking "Booking #35;ID — equipment names" and "🏠 Main Menu"
        end
    end
    Member->>Telegram: taps a "Booking #35;ID — ..." button
    Telegram->>Worker: webhook, handleFlowText(ctx)
    Worker->>KV: get session
    alt text has no "Booking #35;number"
        Worker->>Telegram: "Please tap one of the buttons above."
    else booking number found
        Worker->>KV: put session step awaiting_start_confirm, startBookingId
        Worker->>Worker: renderStartConfirm(ctx, bookingId)
        Worker->>D1: read booking times and its items not cancelled or returned
        alt booking not found
            Worker->>Telegram: "Booking not found." with "🏠 Main Menu"
        else found
            Worker->>Telegram: "Start booking #35;ID now?" with equipment and time lines and "Tap Confirm to start, or Cancel." Buttons "✅ Confirm", "Cancel", "🏠 Main Menu"
        end
    end
    Member->>Telegram: taps "✅ Confirm"
    Telegram->>Worker: webhook, handleFlowText(ctx)
    alt chat has no linked user
        Worker->>Telegram: showMainMenu
    else text is "Cancel"
        Worker->>Telegram: "Start cancelled." with "🏠 Main Menu"
    else text is neither Confirm nor Cancel
        Worker->>Telegram: "Send Confirm or Cancel."
    else text is "✅ Confirm"
        Worker->>Worker: startBookingForChat(ctx, bookingId) calls startBooking(database, bookingId)
        alt booking missing, not in status booked, already started, or outside the 15 minute window, or no startable items
            Worker->>Worker: startBooking throws an error
            Note over Worker: not caught here, webhook answers 500 and the member gets no reply
        else ok
            Worker->>D1: set booking.started_at = now
            Worker->>D1: set non-cancelled, non-returned booking_item status = active
            Worker->>D1: recomputeBookingStatus, booking.status derived from items
            loop each started item with a calendar event
                Worker->>Calendar: updateCalendarEventRaw, title "(ACTIVE)", start = actual pickup time, end = booked end
            end
            Worker->>Worker: logBookingActivityById(bookingId, picked_up)
            Note over Worker: posts "▶️ Picked up by NAME" to the club channel, see channel logging diagram
            opt member has a chat id and settings.global_booking_note is not empty
                Worker->>Telegram: sendMessage to the member with the global booking note text
            end
            Worker->>Telegram: "✅ Booking #35;ID has been started." plus "The equipment is now marked as picked up. Use the Return Equipment flow when done." and "🏠 Main Menu"
        end
    end
```

## Returning equipment with a photo

Triggered by `/return_equipment` or `↩️ Return Equipment`. Only items with status `active` or `overdue` can be returned, with no time filter. The photo goes to the club channel only.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Telegram
    participant Worker
    participant KV
    participant D1
    participant Calendar

    Member->>Telegram: taps "↩️ Return Equipment"
    Telegram->>Worker: webhook, handleEndBooking(ctx)
    Worker->>D1: find user by telegram_chat_id
    alt chat not linked
        Worker->>Telegram: "Please link your account via /start first." and remove keyboard
    else linked
        Worker->>D1: user bookings with items active or overdue
        alt none
            Worker->>Telegram: "You have no active bookings to return." with "🏠 Main Menu"
        else some
            Worker->>KV: put session step awaiting_booking_selection, TTL 1 hour
            Worker->>Telegram: "Select which booking to return:" with a "Booking #35;ID — equipment" button each and "🏠 Main Menu"
        end
    end
    Member->>Telegram: taps a booking button
    Telegram->>Worker: webhook, handleFlowText(ctx)
    alt no "Booking #35;number" in text
        Worker->>Telegram: "Please tap one of the buttons above."
    else booking number found
        Worker->>KV: put session step awaiting_item_selection, selectedBookingIds
        Worker->>Worker: renderReturnItemSelection(ctx, bookingId)
        Worker->>D1: returnable items of that booking owned by this user
        alt no items
            Worker->>Telegram: "No items to return for this booking." then the booking list again
        else items
            Worker->>KV: put session step awaiting_item_selection with activeBookingIds
            Worker->>Telegram: "Select which items to return for booking #35;ID:" numbered list, buttons 1..N, "Return All Items", "🏠 Main Menu"
        end
    end
    Member->>Telegram: taps a number or "Return All Items"
    Telegram->>Worker: webhook, handleFlowText(ctx)
    Worker->>D1: returnable items of the booking, owned by this user
    alt no valid number or no match
        Worker->>Telegram: "Please tap one of the buttons above."
    else valid
        Worker->>KV: put session step awaiting_photo, selectedItemIds
        Worker->>Telegram: "Send a photo of the equipment." with "🏠 Main Menu"
    end
    Member->>Telegram: sends a photo
    Telegram->>Worker: webhook, handlePhoto(ctx)
    Worker->>Worker: pick the last (largest) size in the photo array, take its file_id
    Worker->>KV: get session
    alt no session, or step is not awaiting_photo, or no selected items
        Note over Worker: nothing happens, no reply
    else awaiting_photo
        Worker->>Worker: returnBookingItems(database, selectedItemIds)
        Worker->>D1: set item status = returned and returned_at = now, for items not already returned or cancelled
        Worker->>D1: recomputeBookingStatus, booking.status derived from items
        loop each returned item with a calendar event
            Worker->>Calendar: updateCalendarEventRaw, title "(RETURNED)", end = actual return time
        end
        alt nothing was updated, items were already returned
            Note over Worker: stops silently, no reply
        else updated
            Worker->>D1: read booking id of the first selected item
            Worker->>Worker: logReturnPhotoToChannel(photoFileId, bookingId)
            Worker->>Telegram: sendPhoto to TELEGRAM_CLUB_CHANNEL_ID with the file_id and the Returned log as caption
            Worker->>Telegram: "✅ Return logged for N item(s)." plus "Photo sent to the club channel." with "🏠 Main Menu"
        end
        opt processing error
            Worker->>Telegram: "❌ Error processing return. Please try again." with "🏠 Main Menu"
        end
    end
```

## Cancelling a booking

Triggered by `/cancel_booking` or `❌ Cancel Booking`. Only items still `booked` (never picked up) can be cancelled. The cancel list step does not write a session. The next tap only continues if the session already holds step `awaiting_cancel_selection`.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Telegram
    participant Worker
    participant KV
    participant D1
    participant Calendar

    Member->>Telegram: taps "❌ Cancel Booking"
    Telegram->>Worker: webhook, handleCancelBooking(ctx)
    Worker->>D1: getUserIdByChatId, find user by telegram_chat_id
    alt chat not linked
        Worker->>Telegram: "Please link your account via /start first." and remove keyboard
    else linked
        Worker->>D1: user bookings with items in status booked
        alt none
            Worker->>Telegram: "You have no upcoming bookings to cancel." with "🏠 Main Menu"
        else some
            Worker->>Telegram: "Select which booking to cancel:" with "Booking #35;ID — equipment" buttons and "🏠 Main Menu"
            Note over Worker: no session is written here
        end
    end
    Member->>Telegram: taps a booking button
    Telegram->>Worker: webhook, handleFlowText(ctx)
    Worker->>KV: get session
    alt no session or no step
        Worker->>Telegram: showMainMenu
    else step awaiting_cancel_selection
        alt no "Booking #35;number" in text
            Worker->>Telegram: "Please tap one of the buttons above."
        else found
            Worker->>KV: put session step awaiting_cancel_items, cancelBookingId
            Worker->>Worker: renderCancelBookingItems(ctx, bookingId)
            Worker->>D1: items of that booking in status booked, owned by this user
            alt no items left
                Worker->>Telegram: "Booking #35;ID has no cancellable items left." with "🏠 Main Menu"
            else items
                Worker->>Telegram: "Booking #35;ID", numbered items, "Send the number of the item you want to cancel:" Buttons 1..N, "Cancel All Items (N)", "⬅️ Back to bookings", "🏠 Main Menu"
            end
        end
    end
    Member->>Telegram: taps a number, "Cancel All Items (N)" or "⬅️ Back to bookings"
    Telegram->>Worker: webhook, handleFlowText(ctx)
    alt text is "⬅️ Back to bookings"
        Worker->>KV: put session step awaiting_cancel_selection
        Worker->>Telegram: the cancel booking list again
    else no valid choice
        Worker->>Telegram: "Please tap one of the buttons above."
    else valid
        Worker->>KV: put session step awaiting_cancel_confirm, pendingCancelItemIds
        Worker->>Telegram: "Cancel all items in booking #35;ID?" or the item name in quotes, with "✅ Confirm", "Cancel", "🏠 Main Menu"
    end
    Member->>Telegram: taps "✅ Confirm" or "Cancel"
    Telegram->>Worker: webhook, handleFlowText(ctx)
    alt text is "Cancel"
        Worker->>KV: put session step awaiting_cancel_items
        Worker->>Telegram: the item list for the booking again
    else text is neither
        Worker->>Telegram: "Send Confirm or Cancel."
    else text is "✅ Confirm"
        Worker->>Worker: cancelItems(ctx, userId, itemIds)
        Worker->>D1: keep only the member's own items
        alt none owned
            Worker->>Telegram: "Item not found."
        else none still booked
            Worker->>Telegram: "This item has already been picked up and can only be cancelled while it is still booked. Use the Return Equipment flow instead."
        else some booked
            Worker->>Worker: cancelBookingItems(database, itemIds)
            Worker->>D1: set item status = cancelled
            Worker->>D1: recomputeBookingStatus
            loop each cancelled item with a calendar event
                Worker->>Calendar: deleteCalendarEventRaw
            end
            alt all already cancelled or returned
                Worker->>Telegram: "The selected items are already cancelled or returned."
            else cancelled
                Worker->>Worker: logBookingActivityById(bookingId, cancelled) per touched booking
                Note over Worker: posts the Cancelled log to the club channel, errors are only logged
                Worker->>Telegram: "Cancelled NAMES (booking #35;IDS)." with "🏠 Main Menu"
            end
        end
    end
```

## Club channel activity logs

Booking actions done through the bot post to the club channel `TELEGRAM_CLUB_CHANNEL_ID`. Logging never throws and does nothing when the bot token or channel id is missing. The same logging functions are also used by the web app and cron, which are covered in the other scenario files.

```mermaid
sequenceDiagram
    autonumber
    participant Worker
    participant D1
    participant Telegram

    Worker->>Worker: logBookingActivityById(bookingId, event, options)
    alt bot token or channel id not set
        Note over Worker: nothing is sent
    else enabled
        Worker->>D1: getBookingDetailsForLogging: booking, user and item names and statuses
        alt booking not found
            Note over Worker: warning in console, nothing sent
        else found
            Worker->>Worker: formatBookingLog(data)
            Note over Worker: Header "EVENT by ACTOR" where EVENT is Booked, Picked up, Extended, Items added, Edited, Overdue, Cancelled, Auto-cancelled (no pickup), Returned or Deleted. Partial cancels and returns say "N of M" and strike through the affected items. Free text is cut to 200 characters. Then the equipment line, notes, the time range in Asia/Almaty, an optional reason, a link to the admin booking page, and the tag booking plus the id.
            Worker->>Telegram: sendMessage to the channel as HTML with link previews off
        end
    end
    Worker->>Worker: logReturnPhotoToChannel(photoFileId, bookingId)
    Worker->>D1: load booking log data for event returned
    Worker->>Worker: formatBookingLog(data)
    alt caption visible length over 1024 characters
        Worker->>Worker: format again with compact equipment, "N items" instead of names
    end
    Worker->>Telegram: sendPhoto to the channel with caption as HTML
    opt Telegram error
        Note over Worker: only logged to console, the member still sees "Photo sent to the club channel."
    end
    Worker->>Worker: logAlbumActivity and logAlbumActivityByUser(userId, input)
    Worker->>D1: read the user's name and telegram username
    Worker->>Telegram: sendMessage to the channel with the Album log (see album scenario file)
    Worker->>Worker: logUserBanActivity(input)
    Worker->>Telegram: sendMessage to the channel "🚫 User banned by ACTOR" or "✅ User unbanned by ACTOR" with name, reason and admin user link
```
