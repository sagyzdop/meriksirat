# Booking Flow

How equipment bookings work end to end in Meriksirat — from creating a booking
through pickup, the rental period, returns, cancellations, and the automated
cron jobs that keep everything in sync.

## Data model

A **booking** is a parent record (one user, one time range) that contains one
**booking item per piece of equipment**. Each item tracks its own lifecycle,
and the parent booking's status is always _derived_ from its items' statuses —
it is never set directly by the user flows.

Key columns:

- `booking`: `user_id`, `start_time`, `end_time`, `status`, `started_at`,
  `user_event_details` (notes), reminder tracking columns.
- `booking_item`: `booking_id`, `equipment_id`, `status`, `returned_at`,
  `google_calendar_event_id`.
- `user`: violation counters `cancelled_in_start_window_count` and
  `overdue_count` (both tracked **per booking**, not per item).

### Statuses

| Status               | Meaning                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `booked`             | Created, equipment reserved, not picked up yet.                     |
| `active`             | Equipment picked up (booking started).                              |
| `overdue`            | Equipment still out 15+ minutes after the booking end time.         |
| `partially_returned` | Some items returned, others still out.                              |
| `returned`           | All items returned.                                                 |
| `cancelled`          | Never picked up and cancelled (by the user, admin, or auto-cancel). |

### Status derivation

Parent booking status is recomputed from its items by
`deriveParentBookingStatus` (`src/lib/booking/status.ts`):

1. All items `cancelled` → `cancelled`
2. All items `returned` → `returned`
3. Any item `overdue` → `overdue`
4. Some items `returned` (and others not) → `partially_returned`
5. Any item `active` → `active`
6. Otherwise → `booked`

Every item/booking transition calls `recomputeBookingStatus`, which re-derives
and persists the parent status.

## Booking lifecycle

### 1. Creating a booking (web)

1. Browse the **Equipment** catalog (equipment you lack clearance for is hidden).
2. Open an item to see its **Availability** (Google Calendar) and pick one or
   more consecutive 30-minute slots.
3. Multiple equipment can be selected together; the cart persists in
   `localStorage` and shows all items color-coded on a shared availability
   calendar.
4. On submit, the server checks **free/busy on every equipment calendar** in
   the requested window. A conflict fails the whole booking and names the
   conflicting item(s). The user note + the global booking note are stored.
5. The parent booking is created with status `booked`, and **one item per
   equipment** is inserted with status `booked`. Each item gets its **own
   Google Calendar event** in that equipment's calendar:
   - Summary: `<Equipment> - Booking`
   - Start/end: the booked window
   - Description: structured details (booking ID, user, equipment, booked
     time, status, notes) plus the global note.
6. Booking creation is logged to the Telegram club channel. If calendar event
   creation fails partway, the whole booking is rolled back (events deleted,
   items and parent removed).

### 2. Adding items to an existing booking (web)

- Only allowed while the parent booking is still `booked` (not started).
- New items are availability-checked against the booking's window before
  insertion; each gets its own calendar event.
- Enforced on the server (`assertBookingAccess`), so it holds for both users
  and admins.

### 3. Pickup — starting the booking

A booking can be started only inside its **start window**: `start_time − 15`
to `start_time + 15` minutes (`START_WINDOW_GRACE_MS`). Started from either:

- **Web**: "Start pickup" button (booking owner only).
- **Telegram**: "Start Booking" → pick the booking → confirm.

`startBooking` (`src/lib/booking/start-booking.ts`) requires the parent to be
`booked` with no `started_at`. On success:

- `booking.started_at` is set to the actual pickup time.
- **All non-cancelled/non-returned items become `active`**.
- Each item's calendar event is updated: start becomes the **actual** pickup
  time, end stays the booked end, summary becomes `<Equipment> (ACTIVE)`.
- Parent status is recomputed (`active`), and the transition is logged.

### 4. Reminders (cron, every 5 minutes)

`sendBookingReminders` sends four Telegram reminders, each idempotent via its
own tracking column on the booking:

| Kind             | When                                         | Tracking column           |
| ---------------- | -------------------------------------------- | ------------------------- |
| `pre_start`      | ~15 min before `start_time`                  | `start_reminder_sent_at`  |
| `start_warning`  | at `start_time` (booking still `booked`)     | `start_warning_sent_at`   |
| `return_warning` | at `end_time` (items not returned/cancelled) | `return_reminder_sent_at` |
| `grace_5min`     | 5 min before the end of the 15-min grace     | `grace_warning_sent_at`   |

### 5. Auto-cancel of never-started bookings (cron, every 5 minutes)

`cancelUnstartedBookings` finds `booked` bookings with no `started_at` whose
`start_time` is more than 15 minutes in the past. For each:

1. All items are cancelled through the shared `cancelBookingItems` (this deletes
   each item's calendar event and recomputes the parent status → `cancelled`).
2. `user.cancelled_in_start_window_count` is incremented **once per booking**.
3. The auto-cancel is logged and the user gets a Telegram notification.

### 6. Overdue items (cron, every 5 minutes)

`updateOverdueBookings` finds `active` items whose booking `end_time` is more
than 15 minutes in the past:

1. Each such item becomes `overdue`. Its calendar event summary becomes
   `<Equipment> (OVERDUE)` and the description is updated, but the **event
   times are never changed**.
2. The parent booking status is recomputed once per booking (any overdue item
   makes the parent `overdue`).
3. `user.overdue_count` is incremented **once per booking** (a booking with
   several overdue items counts once).
4. The user is notified via Telegram that the booking is overdue.

## Cancel (booked only)

**Only bookings/items that were never picked up (`booked`) can be cancelled.**
Once equipment is out (`active`/`overdue`), it must go through the **return**
flow instead. This rule is enforced consistently:

- **Telegram**: the cancel flow only lists `booked` items, and the confirm step
  re-checks status so a stale button press can't cancel picked-up equipment.
- **Web (user)**: `cancelBookingFn` rejects any booking whose status isn't
  `booked`.
- **Web (admin)**: status updates to `cancelled` are rejected unless the
  booking is `booked`.
- **Shared logic** (`cancelBookingItems`): skips already-cancelled/returned
  items and deletes each affected item's Google Calendar event.

Cancelling an item sets it to `cancelled`, recomputes the parent status (all
items cancelled → booking `cancelled`), and logs the action.

### Telegram cancel flow (nested)

1. **Cancel Booking** (menu button or `/cancel_booking`) → shows the list of
   bookings that still have `booked` items: `Select which booking to cancel:`.
2. Pick a booking → shows that booking's `booked` items with buttons for each
   item, **Cancel all items (N)**, **Back to bookings**, and **Main Menu**.
3. Picking an item (or "Cancel all") shows an inline **Yes / No** confirmation.
4. Confirming cancels the item(s); the result is shown in place.

## Return (active / overdue only)

Returns happen **only through Telegram** (the web UI intentionally has no
return endpoint — return buttons point at the bot). Only items that were
actually picked up (`active` or `overdue`) are returnable. `booked` items were
never picked up and must be cancelled instead. There is **no time filter** on
the return list, so a booking started up to 15 minutes early (items `active`
while its start time is still in the future) can still be returned.

### Telegram return flow (nested)

1. **End Booking** (menu button or `/return_equipment`) → shows the list of
   bookings with returnable items: `Select which booking to return:`.
2. Pick a booking → shows that booking's `active`/`overdue` items with a button
   per item, **Return All Items**, and **Main Menu**.
3. Picking item(s) or "Return All" prompts: **send a photo of the equipment**.
4. Sending the photo (`handlePhoto`) completes the return.

### What a return does

`returnBookingItems` (`src/lib/booking/booking-items.ts`):

1. Selected items are set to `returned` with `returned_at` = now.
2. The parent booking status is recomputed (see derivation — returning some but
   not all items yields `partially_returned`).
3. Each returned item's calendar event is updated:
   - Start becomes the **actual pickup time** (or the booked start if the
     booking was never started).
   - End becomes the **actual return time** (uncapped — a late return is
     reflected exactly).
   - Summary becomes `<Equipment> (RETURNED)`.
4. The return is logged to the Telegram club channel (whole-booking vs partial
   is reflected in the log), and **all admins** with a linked Telegram account
   get the return photo with a caption.

## Extend (web)

- Adds 30 minutes to the booking end time, but only if every active item's
  calendar is free for the extra half hour (checked live on click).
- Allowed for `booked`, `active`, `partially_returned`, and `overdue`
  bookings — but not `cancelled`/`returned`.
- Calendar events are updated to the new end time.
- **Overdue forgiveness**: if the extended end time is still in the future,
  overdue items revert to `active` and the user's `overdue_count` is
  decremented once (floor 0). If the extended end is still in the past, the
  booking stays overdue until enough extensions push it past "now".

## Violation counters

Two counters live on `user`, both incremented **per booking** (never per item):

- `cancelled_in_start_window_count` — +1 when a booking is auto-cancelled for
  not being picked up within 15 minutes of its start time.
- `overdue_count` — +1 when a booking becomes overdue; −1 (floor 0) when an
  overdue booking is extended into the future.

Admins can reset both via the user management UI.

## Telegram bot menu

The bot is menu-driven (one editable inline-keyboard message, no command list):

- **📋 My Bookings** — plain-text summary of the user's active/upcoming
  bookings with item statuses.
- **▶️ Start Booking** — bookings in the open start window.
- **↩️ End Booking** — bookings with `active`/`overdue` items.
- **❌ Cancel Booking** — bookings with `booked` items.

Only real notifications (reminders, auto-cancel, overdue, admin alerts) are
sent as separate messages.

## Implementation map

| Concern                      | Location                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| Status derivation            | `src/lib/booking/status.ts`                                                              |
| Start (shared)               | `src/lib/booking/start-booking.ts`                                                       |
| Cancel/return items (shared) | `src/lib/booking/booking-items.ts`                                                       |
| Booking detail formatter     | `src/lib/booking/details.ts`                                                             |
| Web booking functions        | `src/lib/booking/functions/*`                                                            |
| Telegram return flow         | `src/lib/telegram/commands/end-booking.ts`, `callback.ts`, `photo.ts`                    |
| Telegram cancel flow         | `src/lib/telegram/commands/cancel-booking.ts`                                            |
| Cron jobs                    | `server.ts` (`cancelUnstartedBookings`, `updateOverdueBookings`, `sendBookingReminders`) |
