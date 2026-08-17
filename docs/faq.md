# Frequently Asked Questions

## Getting Started

### How do I create an account?

Sign in with your Google account. You'll be guided through an onboarding
process where you provide your name, date of birth, NU ID, major, and
graduation year. You'll also link your Telegram account for notifications.

### Why do I need to link Telegram?

Telegram is required for equipment returns and booking notifications. You'll
receive reminders about upcoming bookings, and you use the Telegram bot to
return equipment with photo verification. See [Telegram Bot](user/telegram-bot.md).

### Can I delete my account?

No. Accounts and activity records are retained permanently for equipment
accountability purposes. If you need your account deactivated, contact an
administrator. See [Terms of Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md).

## Booking Equipment

### How do I book equipment?

1. Browse the **Equipment** catalog. Items you lack clearance for are hidden.
2. Open an item to see its **Availability** calendar and pick one or more
   consecutive 30-minute time slots.
3. You can select **multiple items** from the catalog and book them together —
   the cart persists in `localStorage` and shows all items on a shared
   availability calendar.
4. Confirm the booking. Conflicts are detected server-side.

See [Booking Flow](user/booking.md) for the full lifecycle.

### How long can I book for?

Any duration within the operating hours set by administrators, in 30-minute
increments. You can select multiple consecutive slots for longer bookings.

### What happens if I don't pick up my equipment?

You have a 15-minute window around your start time to confirm pickup. If you
don't start the booking within that window, it is automatically cancelled and
you receive a Telegram notification. Repeated no-shows are tracked.

### Can I extend my booking?

Yes. You can extend by 30 minutes if the next time slot is free on every
equipment calendar. Extensions are available for `booked`, `active`,
`partially_returned`, and `overdue` bookings. If you're overdue and the
extension pushes the end time into the future, overdue status is cleared.

### Can I cancel a booking?

Only bookings that haven't been picked up (`booked` status) can be cancelled.
Once equipment is in your possession (`active` or `overdue`), you must go
through the return flow instead.

You can cancel from:

- **Web**: your bookings page
- **Telegram**: "Cancel Booking" menu option

## Returns

### How do I return equipment?

Returns are done through the **Telegram bot**:

1. Select "End Booking" from the bot menu.
2. Choose the booking and items to return.
3. Send a photo of the equipment.
4. The return is logged and admins are notified.

There is no return endpoint on the web — return buttons direct you to the bot.

### Can I return some items and keep others?

Yes. The return flow lets you select specific items. Returning some but not
all items sets the booking to `partially_returned`.

### What if I return equipment late?

If equipment is not returned by the booking end time plus a 15-minute grace
period, items become `overdue`. You'll receive a Telegram notification. You can
still return overdue equipment through the normal flow.

## Photo Albums

### What are albums?

Albums are photo galleries backed by Google Drive. Each album is a folder in a
shared Google Drive account. You can upload photos directly from your browser.

### Who can see my albums?

Albums are public by default. You can toggle visibility, but the Google Drive
folder stays publicly accessible (photos load from Google's CDN). The
visibility toggle only controls whether the album appears in the app's public
gallery.

### How do I upload photos?

Open your album and use the upload button. Photos upload directly from your
browser to Google Drive — they don't pass through the server. Uploads are
tracked in a progress widget in the site header.

### Can I share an album with specific people?

Yes. Every album has an edit share link. Anyone with the link can claim
co-author access and upload photos to that album.

## Telegram Bot

### What can I do with the bot?

The bot is menu-driven (inline keyboard, not slash commands):

- **My Bookings** — view active and upcoming bookings
- **Start Booking** — confirm pickup for bookings in the start window
- **End Booking** — return equipment by selecting items and sending a photo
- **Cancel Booking** — cancel bookings that haven't been picked up

### What notifications will I receive?

- **Reminders**: 15 min before pickup, at start time, at end time, and 5 min
  before grace period ends
- **Overdue alerts**: when your booking becomes overdue
- **Auto-cancel**: when a booking is cancelled for not being picked up

See [Telegram Bot](user/telegram-bot.md) for details.

## Clearance Levels

### Why can't I see certain equipment?

Some equipment requires a minimum clearance level. If your clearance is below
the required level, that equipment is hidden from your catalog. Contact an
administrator to request access.

### How do I get a higher clearance level?

Ask an administrator. They can adjust your clearance level through the User
Management page.

## Availability & Calendar

### How does availability work?

Each piece of equipment has a dedicated Google Calendar. When someone books
it, an event is created on that calendar. The equipment page shows a live
calendar view of all bookings. Real-time free/busy checks prevent double
booking.

### Why does availability sometimes show "Unavailable" when I expect it to be free?

The availability badge checks the Google Calendar free/busy API for the next
bookable window. If there's an event you can't see (e.g., set by an admin or
from a different source), the equipment will show as unavailable.

## Troubleshooting

### I got a "conflict" error when booking

Another booking already occupies one or more of the time slots you selected.
Check the equipment's availability calendar to find an open window.

### My Telegram bot isn't responding

Make sure your Telegram account is linked. Go to your profile page and check
the Telegram connection status. If it's not linked, use the link provided on
your profile to connect.

### The equipment I returned still shows as active

Returns are processed through Telegram. Make sure you completed the full
return flow (including sending the photo). If the issue persists, contact an
administrator.
