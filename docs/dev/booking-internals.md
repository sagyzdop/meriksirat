# Booking Internals

Developer reference for how bookings work under the hood. The user-facing flow
lives in `../user/booking.md`.

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

## Calendar event mechanics

Each booking item owns its own Google Calendar event in that equipment's
calendar (`google_calendar_event_id`):

- **Creation**: summary `<Equipment> - Booking`, booked window, structured
  description (booking ID, user, equipment, time, status, notes) plus the
  global note. If event creation fails partway, the whole booking is rolled
  back (events deleted, items and parent removed).
- **Start**: start becomes the actual pickup time, end stays booked, summary
  becomes `<Equipment> (ACTIVE)`.
- **Return**: start becomes actual pickup (or booked start if never started),
  end becomes actual return time (uncapped — late returns reflected exactly),
  summary `<Equipment> (RETURNED)`.
- **Overdue**: summary becomes `<Equipment> (OVERDUE)`; **event times are
  never changed**.
- **Extend / cancel**: events updated to the new end time / deleted.

## Enforcement points

- **Adding items**: only while the parent is `booked`; server-side via
  `assertBookingAccess`, so it holds for users and admins alike.
- **Cancel**: only `booked` bookings/items can be cancelled.
  `cancelBookingFn` rejects anything else; admin status updates are rejected
  unless `booked`; the Telegram cancel flow re-checks status at confirm time
  so stale button presses can't cancel picked-up equipment.
  `cancelBookingItems` skips already-cancelled/returned items and deletes
  each affected item's calendar event.
- **Return**: Telegram-only (no web return endpoint); only `active`/`overdue`
  items. No time filter on the return list.
- **Start**: `startBooking` (`src/lib/booking/start-booking.ts`) requires the
  parent to be `booked` with no `started_at`; window is
  `start_time − 15` to `start_time + 15` minutes
  (`START_WINDOW_GRACE_MS`).

## Cron jobs (every 5 minutes, `server.ts`)

### Reminders (`sendBookingReminders`)

Four idempotent Telegram reminders, each tracked by its own column:

| Kind             | When                                         | Tracking column           |
| ---------------- | -------------------------------------------- | ------------------------- |
| `pre_start`      | ~15 min before `start_time`                  | `start_reminder_sent_at`  |
| `start_warning`  | at `start_time` (booking still `booked`)     | `start_warning_sent_at`   |
| `return_warning` | at `end_time` (items not returned/cancelled) | `return_reminder_sent_at` |
| `grace_5min`     | 5 min before the end of the 15-min grace     | `grace_warning_sent_at`   |

### Auto-cancel (`cancelUnstartedBookings`)

Finds `booked` bookings with no `started_at` whose `start_time` is more than
15 minutes in the past. For each: all items cancelled through the shared
`cancelBookingItems` (deletes calendar events, recomputes parent →
`cancelled`), `user.cancelled_in_start_window_count` incremented **once per
booking**, logged to the audit channel, user notified via Telegram.

### Overdue (`updateOverdueBookings`)

Finds `active` items whose booking `end_time` is more than 15 minutes in the
past. Each such item becomes `overdue`; the parent is recomputed once per
booking; `user.overdue_count` incremented **once per booking**; user notified.

### Extend side effects

Overdue forgiveness: if an extension pushes the end time into the future,
overdue items revert to `active` and `overdue_count` decrements once
(floor 0).

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
