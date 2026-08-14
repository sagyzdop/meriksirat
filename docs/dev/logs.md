# Telegram Log Messages

Inventory of every message the system can send over Telegram, grouped by
destination. This is the current implementation; the formats below are the
source of truth for the logging logic.

---

## 1. Audit channel logs (booking activity)

Destination: `TELEGRAM_CLUB_CHANNEL_ID` (audit channel).
Implementation: `src/lib/telegram/logging.ts` (`formatBookingLogMessage`).
All booking activity goes through `logBookingActivityById(bookingId, action, { previousStatus, newStatus, notes })`, which auto-fetches the booking details (user display name, equipment names, per-item statuses, times) and renders the message.

### 1a. Full booking event (all items affected together)

```
Booking #{bookingId} · {Action}
User: {userDisplayName}
Status: {Previous} → {New}      ← only when previousStatus != newStatus
Status: {New}                    ← only when newStatus present and unchanged
Equipment: {name1}, {name2}
Booking Time: {date}, {HH:MM} – {HH:MM}
Started at: {HH:MM}              ← only when startedAt present
Notes: {notes}                   ← only when notes present
```

Action labels: `created` → Created, `updated` → Updated, `cancelled` → Cancelled, `returned` → Returned, `deleted` → Deleted.
Statuses are shown title-cased with underscores replaced by spaces (`booked`, `active`, `overdue`, `partially_returned`, `cancelled`, `returned`).

### 1b. Partial item event (only some items cancelled/returned)

When the item statuses show that fewer than all items changed:

```
Booking #{bookingId}
User: {userDisplayName}
Event: {n} of {total} items {cancelled|returned} ({name1}, {name2})
Remaining: {name3}
Booking Time: {date}, {HH:MM} – {HH:MM}   ← optional
Started at: {HH:MM}                       ← optional
Notes: {notes}                            ← optional
```

### Emitters of `logBookingActivityById`

| Action | Trigger | Caller | Options passed |
| --- | --- | --- | --- |
| `created` | User creates a booking (web) | `src/lib/booking/functions/user-bookings.ts` | `newStatus: 'booked'`, `notes` |
| `updated` | User edits schedule/notes (web) | `user-bookings.ts` | `newStatus` (current), `notes` (new notes) |
| `updated` | Admin edits schedule/notes | `src/lib/booking/functions/admin-bookings.ts` | `notes: "Admin {name} updated booking{ schedule}{. Notes: {notes}}"` |
| `updated` | Admin adds equipment to booking | `src/lib/booking/functions/booking-items.ts` | `notes: "Added equipment to booking: {name1}, {name2}"` |
| `updated` | Booking extended +30 min (web) | `src/lib/booking/functions/extend-booking.ts` | `notes: "Booking extended by 30 minutes to {time}{; overdue status reset}"` |
| `updated` | Booking started (web or Telegram) | `src/lib/booking/start-booking.ts` | `previousStatus: 'booked'`, `newStatus: 'active'`, `notes: "Booking started{ by {email}} at {ISO-timestamp}"` |
| `cancelled` | User cancels whole booking (web) | `user-bookings.ts` | `previousStatus` (current), `newStatus: 'cancelled'` |
| `cancelled` | Admin cancels booking | `admin-bookings.ts` | `previousStatus`, `newStatus: 'cancelled'`, `notes: "Booking cancelled by admin {name}{. Reason: {reason}}"` |
| `cancelled` | User cancels one item (Telegram) | `src/lib/telegram/commands/cancel-booking.ts` | `previousStatus` (item status), `newStatus: 'cancelled'` |
| `cancelled` | User cancels one item (web) | `src/lib/booking/functions/booking-items.ts` | `newStatus: 'cancelled'`, `notes: "Item cancelled via web"` |
| `cancelled` | Cron auto-cancel (never started) | `server.ts` | `previousStatus: 'booked'`, `newStatus: 'cancelled'`, `notes: "Booking auto-cancelled: equipment was not picked up within 15 minutes of the start time"` |
| `returned` | User returns items (Telegram photo) | `src/lib/telegram/commands/photo.ts` | `notes: "Returned {n} item(s) via Telegram"` |
| `deleted` | Admin deletes booking (web) | `admin-bookings.ts` | `notes: "Booking permanently deleted by administrator"` |

---

## 2. Admin return notifications

Destination: every user with `role = 'admin'` and a linked `telegramChatId`.
Implementation: `src/lib/telegram/admin.ts` (`notifyAdmins`), sent as a photo (`sendPhoto`) when equipment is returned via the Telegram bot.

Caption:

```
Return from {userDisplayName}
Items: {equipmentNames joined ", "}
Count: {itemCount}
```

---

## 3. System notifications to users (cron)

Destination: the affected user's `telegramChatId`.
Implementation: `server.ts`.

### 3a. Auto-cancel notification (`cancelUnstartedBookings`)

Sent when a booking is auto-cancelled after not being started within 15 min of its start time:

```
❌ Booking #{bookingId} was auto-cancelled.

You did not pick up your equipment within 15 minutes of the start time ({HH:MM}). If this wasn't intentional, please make a new booking.
```

### 3b. Overdue notification (`updateOverdueBookings`)

Sent once per booking when items become overdue:

```
⚠️ Booking #{bookingId} is now overdue.

Please return the equipment as soon as possible via the End Booking flow.
```

### 3c. Booking reminders (`sendBookingReminders`)

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

## 4. Bot conversation messages (user-facing)

Destination: the user's chat. Implementation: `src/lib/telegram/commands/*` + `src/lib/telegram/commands/callback.ts`.

### 4a. Account linking (`start.ts`)

| Message |
| --- |
| `Welcome! Please use the link from the web app to connect your account.` |
| `Link expired or invalid.` |
| `Telegram linked ✅\n\nYou can now use the menu below to interact with the bot.` |
| `Error linking account. Please try again.` |

### 4b. Shared guard (`list-bookings.ts`, `start-booking.ts`, `end-booking.ts`, `cancel-booking.ts`)

| Message |
| --- |
| `Please link your account via /start first.` |

### 4c. My Bookings (`list-bookings.ts`)

| Message |
| --- |
| `You have no active or upcoming bookings.` |
| `Your bookings:` + per booking `\n{Active|Upcoming} - Booking #{id} ({status})\n  {date}, {HH:MM} - {HH:MM}\n  - {equipment} ({itemStatus})` |
| `Error fetching bookings. Please try again.` |

### 4d. Start Booking (`start-booking.ts`)

| Message |
| --- |
| `You have no bookings to start right now.\n\nYour booking can be started within 15 minutes of its start time.` |
| `Select which booking to start:` + buttons `#{id} — {equipment names}` |
| `Error fetching bookings. Please try again.` |

### 4e. End Booking / return flow (`end-booking.ts`, `callback.ts`, `photo.ts`)

| Message |
| --- |
| `You have no active bookings to return.` |
| `Select which booking to return:` + buttons `#{id} — {equipment names}` |
| `Select which items to return for booking #{id}:` + buttons `{equipment}` / `Return All Items` |
| `Selected. Please send a photo of the equipment.` |
| `Return logged for {n} item(s). Summary sent to admins.` |
| `❌ Error processing return. Please try again.` |
| `Error fetching bookings. Please try again.` |

### 4f. Cancel Booking (`cancel-booking.ts`)

| Message |
| --- |
| `You have no upcoming or active bookings to cancel.` |
| `Select the item(s) you want to cancel:` + per booking `\nBooking #{id}\n  • {equipment}` |
| `Cancel this item?` (confirm inline) |
| `Cancel all items in booking #{id}?` (confirm inline) |
| `Cancelled {equipment names} (booking #{a}, #{b}).` |
| `Cancellation aborted.` |
| `Error fetching bookings. Please try again.` |

### 4g. Callback query confirmations (`callback.ts`)

| Message |
| --- |
| `Start booking #{id} now?\n\n📦 Equipment: {names}\n🕐 Time: {start} - {end}` (confirm inline) |
| `✅ Booking #{id} has been started.\n\nThe equipment is now marked as picked up. Remember to use "End Booking" when returning it.` |
| `Start cancelled.` |
| `Starting booking...` (callback toast) |
| `Invalid selection` (callback toast) |
| `Session expired or invalid` (callback toast) + `Please use /return_equipment first.` |
| `No items to return` (callback toast) |
| `Error processing selection. Please try again.` |
