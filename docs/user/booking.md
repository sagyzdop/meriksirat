# Booking Flow

How equipment bookings work end to end in Meriksirat — from creating a booking
through pickup, the rental period, returns, cancellations, and the automated
jobs that keep everything in sync. Implementation details (data model,
status derivation, cron internals) live in
[Booking Internals](../dev/booking-internals.md).

## Statuses

| Status               | Meaning                                                      |
| -------------------- | ------------------------------------------------------------ |
| `booked`             | Created, equipment reserved, not picked up yet.              |
| `active`             | Equipment picked up (booking started).                       |
| `overdue`            | Equipment still out 15+ minutes after the booking end time.  |
| `partially_returned` | Some items returned, others still out.                       |
| `returned`           | All items returned.                                          |
| `cancelled`          | Never picked up and cancelled (by the user, admin, or auto). |

A booking holds one item per piece of equipment, each with its own status; the
booking's status is derived from its items.

## Booking lifecycle

### 1. Creating a booking (web)

1. Browse the **Equipment** catalog (equipment you lack clearance for is hidden).
2. Open an item to see its **Availability** (Google Calendar) and pick one or
   more consecutive 30-minute slots.
3. Multiple equipment can be selected together; the cart persists in
   `localStorage` and shows all items color-coded on a shared availability
   calendar.
4. On submit, availability is checked on every equipment calendar in the
   requested window. A conflict fails the whole booking and names the
   conflicting item(s).

Each booked item gets its own Google Calendar event, and the booking is logged
to the club Telegram channel.

### 2. Adding items to an existing booking (web)

- Only allowed while the booking is still `booked` (not started).
- New items are availability-checked against the booking's window before
  insertion.

### 3. Pickup — starting the booking

A booking can be started only inside its **start window**: 15 minutes before
to 15 minutes after the scheduled start time. Start from either:

- **Web**: "Start pickup" button (booking owner only).
- **Telegram**: "Start Booking" → pick the booking → confirm.

On start, the actual pickup time is recorded, all non-cancelled items become
`active`, and the calendar events update to show the booking as active.

### 4. Reminders

Four automatic Telegram reminders fire per booking (before start, at start
time, at end time, and 5 minutes before the grace period ends). See
[Telegram Bot](telegram-bot.md) for the full notification table.

### 5. Auto-cancel of never-started bookings

If you don't start a booking within 15 minutes of its start time, it is
automatically cancelled, you get a Telegram notification, and a no-show is
counted against your account (see violation counters below).

### 6. Overdue items

If equipment is still out more than 15 minutes after the booking end time, its
items become `overdue`, you get a Telegram notification, and an overdue is
counted against your account.

## Cancel (booked only)

**Only bookings/items that were never picked up (`booked`) can be cancelled.**
Once equipment is out (`active`/`overdue`), it must go through the **return**
flow instead. This holds on web (user and admin) and in the Telegram bot.

### Telegram cancel flow

1. **Cancel Booking** (menu button) → shows bookings with `booked` items.
2. Pick a booking → pick individual items or **Cancel all items (N)**.
3. Confirm with the inline **Yes / No** prompt.

Cancelling recomputes the booking status — once all items are cancelled, the
whole booking is `cancelled`.

## Return (active / overdue only)

Returns happen **only through Telegram** (the web UI intentionally has no
return endpoint — return buttons point at the bot). Only items that were
actually picked up (`active` or `overdue`) are returnable.

1. **End Booking** (menu button) → shows bookings with returnable items.
2. Pick a booking → pick items (or **Return All Items**).
3. Send a photo of the equipment — the return completes.

Returning some but not all items yields `partially_returned`. Returned items
get their calendar events updated to the actual pickup/return times, the
return is logged to the club channel, and admins receive the photo.

## Extend (web)

- Adds 30 minutes to the booking end time, but only if every active item's
  calendar is free for the extra half hour (checked live on click).
- Allowed for `booked`, `active`, `partially_returned`, and `overdue`
  bookings — but not `cancelled`/`returned`.
- **Overdue forgiveness**: if the extension pushes the end time into the
  future, overdue items revert to `active` and your overdue count decreases.

## Violation counters

Two counters live on your account, both tracked **per booking**:

- **No-shows** — +1 when a booking is auto-cancelled for not being picked up
  within 15 minutes of its start time.
- **Overdue** — +1 when a booking becomes overdue; −1 (floor 0) when an
  overdue booking is extended into the future.

Admins can reset both via the user management UI.
