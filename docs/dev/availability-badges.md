# Availability Badges (Google Calendar free/busy)

How the "Available / Unavailable" equipment state is computed and why requests are batched.

## What it is

- **Equipment cards** (index page) and the **equipment detail page** badge show
  Available/Unavailable based on a Google Calendar free/busy query over the next
  bookable window.
- The same machinery powers the **booking conflict checks**: the time-slot
  picker, add-items-to-booking, extend-booking, and admin booking flows all call
  the same server fn to refuse double-booked equipment.
- Availability is driven **purely** by Google Calendar events: equipment with no
  events in the window is Available.

## Data flow

1. `useEquipmentAvailability` (client hook,
   `src/components/equipment/index/hooks/use-equipment-availability.ts`) builds
   the UTC window (`buildAvailabilityWindow`) and batches all equipment calendar
   ids into groups of **40**, calling `checkMultipleCalendarsFreeBusy` per group
   in parallel (`Promise.all`). The union of returned busy ids is the
   `busyByEquipmentId` map.
2. `checkMultipleCalendarsFreeBusy`
   (`src/lib/google/google-caledar.ts:227`) re-batches *whatever it receives*
   into groups of **15** and fires one Google `POST /freeBusy` per group in
   parallel, merging the responses into
   `{ [calendarId]: { busy: [{ start, end }] } }`.
3. The single-calendar `checkCalendarFreeBusy` (detail badge, time-slot picker)
   sends one item per request — no batching needed.

## Why batching (the ~20-item cliff)

Google's documented free/busy limit is 50 items per request, but the live API
**silently drops busy data for some calendars** once a single request carries
more than ~20 items. The drops are deterministic per composition, so they are
not transient:

- One request with all 31 calendars reported only **5** of the 8 genuinely-busy
  calendars.
- The same window chunked into batches of ≤20 returned **all 8** busy calendars
  every time.

The server constant **15** leaves headroom below that threshold, so callers do
not have to know about the limit — the server fn always chunks correctly. The
client-side 40 is only a cap on the number of RPC calls the UI makes; the server
re-chunks regardless.

## Not a loop

Batching is **parallel**, not sequential. For 31 calendars the server sends
`15 + 15 + 1` = 3 Google requests concurrently via `Promise.all`. The client
does the same across its chunks.

## Code locations

| Layer | Constant | Location |
| ----- | -------- | -------- |
| Client batch size | `MAX_CALENDARS_PER_REQUEST = 40` | `use-equipment-availability.ts:12` |
| Server batch size | `MAX_CALENDARS_PER_REQUEST = 15` | `google-caledar.ts:235` (in `checkMultipleCalendarsFreeBusy`) |

## Constraints

- Keep the server constant below **~20** items/request; above that, busy
  calendars get silently dropped and equipment wrongly shows Available.
- The merge falls back to `result.calendars[calendarId]?.busy ?? []`, so
  calendars with no events in the window return empty busy (Available).
- The server fn returns an entry for **every** requested id, so booking
  conflict checks that pass 30+ ids still get correct per-calendar data.
