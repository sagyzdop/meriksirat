# Frequently Asked Questions

## Getting Started

### How do I create an account?

Sign in with Google using an `@nu.edu.kz` or `@alumni.nu.edu.kz` account. If
you are new, logging in means you agree to the terms of service and privacy
policy linked on the login page. Your account is ready straight away. You can browse albums
and favorite photos, and you do not need to connect Google Drive.

Returning users just sign in. People who already had an account keep it,
whatever their email.

### What do I do after I sign up?

To book equipment and create albums you must be a club member. Enter the club
code on your profile whenever you are ready. You will then be asked for your
name, date of birth, NU ID, major and graduation month, and to link your
Telegram account.

Accounts are never removed for being unfinished, so you can come back at any
time.

### Do I have to become a flamekeeper?

No. Flamekeeping is optional and never part of signing up. Only `@nu.edu.kz`
accounts can become flamekeepers, and you can do it from your profile at any
time. See [Flamekeepers](#flamekeepers).

### Why do I need to link Telegram?

Telegram is required for equipment returns and booking notifications. You'll
receive reminders about upcoming bookings, and you use the Telegram bot to
return equipment with photo verification. See [Telegram Bot](user/telegram-bot.md).

### Can I delete my account?

Club members cannot. Their accounts and activity records are retained
permanently for equipment accountability purposes. If you need your account
deactivated, contact an administrator. If you are not a club member, you can
delete your account from your profile once you have stopped flamekeeping and
any photos the Platform stored in your Drive have been moved. See [Terms of
Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md).

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

Albums are photo galleries. Each album is a public folder in the club's Google
storage. You can upload photos directly from your browser.

### Where are my photos stored?

New uploads go to a club-run Gmail account, not to a student's Google Drive.
Your browser uploads straight to Google, and the Platform does not pass the
photos through its own server.

Existing albums were uploaded earlier and remain on the club's main Google
account for now. Flamekeepers hold no photos today.

### Who can see my albums?

Everyone. Every album is public and listed in the public gallery, and its Google
Drive folder is open to anyone with the link (photos load from Google's CDN).
There is no private option, so only upload photos you are happy to have public.

### How do I upload photos?

Open your album and use the upload button. Uploads are tracked in a progress
widget in the site header.

If the club's storage is full, uploads pause and the site says so. Your photos
stay on your device, and you can tell an admin.

### Can I share an album with specific people?

Yes. Every album has an edit share link. Anyone with the link can claim
co-author access and upload photos to that album.

### How long do albums last?

Albums are kept for two years after their event by default. The album's owner
and members get a Telegram reminder 30 days and 7 days before an album expires,
so there is time to download what you need. When an album expires, its photos are deleted,
and there is no backup copy. Only the album's title and the reason it was
removed remain on the site.

Admins can pin an album to keep it longer. If the club needs space, an admin
can also bring an album's expiry forward; it is then kept for 7 more days, and
its owner and members are told.

## Flamekeepers

### What is a flamekeeper?

A flamekeeper is an `@nu.edu.kz` student who pledges part of their own Google
Drive storage to the club as reserve capacity. Flamekeeping is optional, and
you do not need it to use the site.

### How do I become a flamekeeper?

Open the Become a flamekeeper page from your profile or the one-time invitation. It takes three short steps. You will be asked for:

- your expected graduation month, which must be in the future,
- your pledge, at least 512 MB (see below),
- nothing else: connecting your Drive means you agree to the [Terms of Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md).

Then connect the Google Drive account with the same `@nu.edu.kz` address you
signed in with. The Platform asks only for access to the files it creates
(`drive.file`).

### How much do I need to pledge?

The minimum pledge is 512 MB. The pledge is the most storage the Platform may use
in your Drive. You can change it at any time from your profile. A pledge is
reserve space; flamekeepers hold no photos today.

### Will my photos be stored in my Drive?

No. Flamekeepers hold no photos today, and new uploads go to the club-run Gmail
account.

### What can the Platform see in my Drive?

Only the files and folders the Platform creates. It cannot read or change any
other file in your Drive.

### Can I stop flamekeeping?

Yes, at any time from your profile. Stopping ends your pledge, and the Platform
places no photos in your Drive. You can also revoke the Platform's access at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions).
Flamekeepers hold no photos today, so this does not affect any album. See [Privacy Policy](https://github.com/sagyzdop/meriksirat/blob/main/docs/privacy-policy.md)
and [Terms of Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md).

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
