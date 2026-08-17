# Telegram Log Messages

Inventory of every message the system can send over Telegram, grouped by
destination. This is the current implementation; the formats below are the
source of truth for the logging logic.

Formatting conventions:

- People are always rendered as `Name Surname (@telegram)` (no emails, no roles).
- All times are UTC, rendered as `Aug 14, 2026` for dates and `09:00` for times.
- Every log opens with a shared `Event:` line (what happened) followed by a
  `Resource:` line linking to the affected record in the web app.

---

## 1. Audit channel logs (booking activity)

Destination: `TELEGRAM_CLUB_CHANNEL_ID` (audit channel).
Implementation: `src/lib/telegram/logging.ts` (`formatBookingLogMessage`).
All booking activity goes through `logBookingActivityById(bookingId, action, { previousStatus, newStatus, notes, actorName })`, which auto-fetches the booking details (user display name, equipment names, per-item statuses, times) and renders the message. `Resource:` links to the booking details page (`{origin}/bookings/{id}`).

### 1a. Full booking event (all items affected together)

```
Event: {Action} — Booking #{bookingId}
Resource: {origin}/bookings/{bookingId}
User: {Name Surname (@telegram)}
By: {Name Surname (@telegram)}     ← only when actorName is set and differs from the booking's user
Status: {Previous} → {New}         ← only when previousStatus != newStatus
Equipment: {name1}, {name2}
Time: {Mon} {day}, {year}, {HH:MM} – {HH:MM}
Started: {HH:MM}                   ← only when startedAt present
Notes: {notes}                     ← only when notes present
```

Action labels: `created` → Created, `updated` → Updated, `cancelled` → Cancelled, `returned` → Returned, `deleted` → Deleted.
Statuses are shown title-cased with underscores replaced by spaces (`booked`, `active`, `overdue`, `partially_returned`, `cancelled`, `returned`).

### 1b. Partial item event (only some items cancelled/returned)

When the item statuses show that fewer than all items changed:

```
Event: {n} of {total} items {cancelled|returned} — Booking #{bookingId}
Resource: {origin}/bookings/{bookingId}
User: {Name Surname (@telegram)}
By: {Name Surname (@telegram)}     ← optional
Status: {Previous} → {New}         ← optional
Items {cancelled|returned}: {name1}, {name2}
Remaining: {name3}                 ← only when some items remain
Time: {Mon} {day}, {year}, {HH:MM} – {HH:MM}   ← optional
Started: {HH:MM}                   ← optional
Notes: {notes}                     ← optional
```

### Emitters of `logBookingActivityById`

| Action      | Trigger                             | Caller                                        | Options passed                                                                                                                                           |
| ----------- | ----------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `created`   | User creates a booking (web)        | `src/lib/booking/functions/user-bookings.ts`  | `newStatus: 'booked'`, `notes`                                                                                                                           |
| `updated`   | User edits schedule/notes (web)     | `user-bookings.ts`                            | `newStatus` (current), `notes` (new notes)                                                                                                               |
| `updated`   | Admin edits schedule/notes          | `src/lib/booking/functions/admin-bookings.ts` | `actorName`, `notes: "Schedule updated" / "Notes: {notes}"`                                                                                              |
| `updated`   | Admin adds equipment to booking     | `src/lib/booking/functions/booking-items.ts`  | `notes: "Added equipment to booking: {name1}, {name2}"`                                                                                                  |
| `updated`   | Booking extended +30 min (web)      | `src/lib/booking/functions/extend-booking.ts` | `notes: "Booking extended by 30 minutes to {time}{; overdue status reset}"`                                                                              |
| `updated`   | Booking started (web or Telegram)   | `src/lib/booking/start-booking.ts`            | `previousStatus: 'booked'`, `newStatus: 'active'` (start time comes from `Started:`)                                                                     |
| `cancelled` | User cancels whole booking (web)    | `user-bookings.ts`                            | `previousStatus` (current), `newStatus: 'cancelled'`                                                                                                     |
| `cancelled` | Admin cancels booking               | `admin-bookings.ts`                           | `previousStatus`, `newStatus: 'cancelled'`, `actorName`, `notes: "Reason: {reason}"`                                                                     |
| `cancelled` | User cancels one item (Telegram)    | `src/lib/telegram/commands/cancel-booking.ts` | `previousStatus` (item status), `newStatus: 'cancelled'`                                                                                                 |
| `cancelled` | User cancels one item (web)         | `src/lib/booking/functions/booking-items.ts`  | `newStatus: 'cancelled'`, `notes: "Item cancelled via web"`                                                                                              |
| `cancelled` | Cron auto-cancel (never started)    | `server.ts`                                   | `previousStatus: 'booked'`, `newStatus: 'cancelled'`, `notes: "Booking auto-cancelled: equipment was not picked up within 15 minutes of the start time"` |
| `returned`  | User returns items (Telegram photo) | `src/lib/telegram/commands/photo.ts`          | `notes: "Returned {n} item(s) via Telegram"`                                                                                                             |
| `deleted`   | Admin deletes booking (web)         | `admin-bookings.ts`                           | `actorName`                                                                                                                                              |

---

## 2. Return photos

Destination: `TELEGRAM_CLUB_CHANNEL_ID` (audit channel).
Implementation: `src/lib/telegram/logging.ts` (`logReturnPhotoToChannel`).
When equipment is returned via the Telegram bot, a single photo message is sent;
the caption is the full booking `returned` log (identical to section 1), so a
return never produces a separate text log. `Resource:` links to the booking
details page.

Caption (same as 1a/1b with `action = returned`):

```
Event: {n} of {total} items returned — Booking #{bookingId}   (or "Event: Returned — Booking #{bookingId}")
Resource: {origin}/bookings/{bookingId}
User: {Name Surname (@telegram)}
Items returned: {name1}, {name2}
Remaining: {name3}
Time: {Mon} {day}, {year}, {HH:MM} – {HH:MM}
Started: {HH:MM}
Notes: {notes}
```

---

## 3. Album activity logs

Destination: `TELEGRAM_CLUB_CHANNEL_ID` (audit channel).
Implementation: `src/lib/telegram/logging.ts` (`logAlbumActivityByUser`), called from `src/lib/albums/functions.ts` for every album mutation. `Resource:` links to the album's public page (`{origin}/albums/{albumId}`).

```
Event: {Action} — Album "{title}"
Resource: {origin}/albums/{albumId}
By: {Name Surname (@telegram)}
{detail}                              ← action-specific, optional
```

Action labels and details:

| Action                | Emitter              | Detail                                              |
| --------------------- | -------------------- | --------------------------------------------------- |
| `created`             | `createAlbumFn`      | —                                                   |
| `updated`             | `updateAlbumFn`      | `Title: {old} → {new}` and/or `Description updated` |
| `deleted`             | `deleteAlbumFn`      | —                                                   |
| `shared` / `unshared` | `toggleAlbumShareFn` | —                                                   |
| `photo_deleted`       | `deletePhotoFn`      | —                                                   |
| `member_added`        | `claimEditAccessFn`  | —                                                   |
| `member_removed`      | `removeMemberFn`     | `Removed: {Name Surname (@telegram)}`               |
| `token_rotated`       | `rotateEditTokenFn`  | —                                                   |

Photo uploads go straight from the browser to Google Drive and have no
server-side completion hook, so individual uploads are not logged.

---

## 4. System notifications to users (cron)

Destination: the affected user's `telegramChatId`.
Implementation: `server.ts`.

### 4a. Auto-cancel notification (`cancelUnstartedBookings`)

Sent when a booking is auto-cancelled after not being started within 15 min of its start time:

```
❌ Booking #{bookingId} was auto-cancelled.

You did not pick up your equipment within 15 minutes of the start time ({HH:MM}). If this wasn't intentional, please make a new booking.
```

### 4b. Overdue notification (`updateOverdueBookings`)

Sent once per booking when items become overdue:

```
⚠️ Booking #{bookingId} is now overdue.

Please return the equipment as soon as possible via the End Booking flow.
```

### 4c. Booking reminders (`sendBookingReminders`)

Four idempotent reminders (`buildReminderMessage`). `{equipmentLabel}` is a single name or `"{n} items: {name1}, {name2}"`.

pre_start (booking starts in ~15 min):

```
⏰ Booking Reminder

Your booking starts in ~15 minutes.

📦 Equipment: {equipmentLabel}
🕐 Time: {HH:MM} - {HH:MM}

Please arrive on time. Use the "Start Booking" button when you pick up the equipment.
```

start_warning (at/just after start time):

```
🔔 Booking Start Time

Your booking was supposed to start now.

📦 Equipment: {equipmentLabel}
🕐 Time: {HH:MM} - {HH:MM}

Press "Start Booking" now, or the booking will be automatically cancelled in 15 minutes.
```

return_warning (at/just after end time):

```
⏰ Time's Up

Your booking time has ended.

📦 Equipment: {equipmentLabel}

Please return the equipment within the 15-minute grace period. Use the "End Booking" button and send a photo of the equipment.
```

grace_5min (10–15 min after end time):

```
⏰ 5 Minutes Left

You have 5 minutes left in the grace period to return equipment.

📦 Equipment: {equipmentLabel}

Please return it now via the "End Booking" button.
```

---

## 5. Bot conversation messages (user-facing)

Destination: the user's chat. Implementation: `src/lib/telegram/commands/*` + `src/lib/telegram/commands/callback.ts`.

### 5a. Account linking (`start.ts`)

| Message                                                                          |
| -------------------------------------------------------------------------------- |
| `Welcome! Please use the link from the web app to connect your account.`         |
| `Link expired or invalid.`                                                       |
| `Telegram linked ✅\n\nYou can now use the menu below to interact with the bot.` |
| `Error linking account. Please try again.`                                       |

### 5b. Shared guard (`list-bookings.ts`, `start-booking.ts`, `end-booking.ts`, `cancel-booking.ts`)

| Message                                      |
| -------------------------------------------- |
| `Please link your account via /start first.` |

### 5c. My Bookings (`list-bookings.ts`)

| Message                                      |
| -------------------------------------------- |
| `You have no active or upcoming bookings.`   |
| `Your bookings:` + per booking `\n{Active    | Upcoming} - Booking #{id} ({status})\n {date}, {HH:MM} - {HH:MM}\n - {equipment} ({itemStatus})` |
| `Error fetching bookings. Please try again.` |

### 5d. Start Booking (`start-booking.ts`)

| Message                                                                                                        |
| -------------------------------------------------------------------------------------------------------------- |
| `You have no bookings to start right now.\n\nYour booking can be started within 15 minutes of its start time.` |
| `Select which booking to start:` + buttons `#{id} — {equipment names}`                                         |
| `Error fetching bookings. Please try again.`                                                                   |

### 5e. End Booking / return flow (`end-booking.ts`, `callback.ts`, `photo.ts`)

| Message                                                                                        |
| ---------------------------------------------------------------------------------------------- |
| `You have no active bookings to return.`                                                       |
| `Select which booking to return:` + buttons `#{id} — {equipment names}`                        |
| `Select which items to return for booking #{id}:` + buttons `{equipment}` / `Return All Items` |
| `Selected. Please send a photo of the equipment.`                                              |
| `Return logged for {n} item(s).\n\nPhoto sent to the club channel.`                            |
| `❌ Error processing return. Please try again.`                                                |
| `Error fetching bookings. Please try again.`                                                   |

### 5f. Cancel Booking (`cancel-booking.ts`)

| Message                                                                                   |
| ----------------------------------------------------------------------------------------- |
| `You have no upcoming or active bookings to cancel.`                                      |
| `Select the item(s) you want to cancel:` + per booking `\nBooking #{id}\n  • {equipment}` |
| `Cancel this item?` (confirm inline)                                                      |
| `Cancel all items in booking #{id}?` (confirm inline)                                     |
| `Cancelled {equipment names} (booking #{a}, #{b}).`                                       |
| `Cancellation aborted.`                                                                   |
| `Error fetching bookings. Please try again.`                                              |

### 5g. Callback query confirmations (`callback.ts`)

| Message                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------- |
| `Start booking #{id} now?\n\n📦 Equipment: {names}\n🕐 Time: {start} - {end}` (confirm inline)                                     |
| `✅ Booking #{id} has been started.\n\nThe equipment is now marked as picked up. Remember to use "End Booking" when returning it.` |
| `Start cancelled.`                                                                                                                 |
| `Starting booking...` (callback toast)                                                                                             |
| `Invalid selection` (callback toast)                                                                                               |
| `Session expired or invalid` (callback toast) + `Please use /return_equipment first.`                                              |
| `No items to return` (callback toast)                                                                                              |
| `Error processing selection. Please try again.`                                                                                    |
