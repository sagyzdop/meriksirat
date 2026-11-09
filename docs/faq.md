# Frequently Asked Questions

The questions are grouped into three parts: **everyone** with an account,
**club members**, and **flamekeepers**.

- [Everyone](#everyone)
- [Club Members](#club-members)
- [Flamekeepers](#flamekeepers)

## Bans

### What happens if I am banned?

An admin can ban an account for abusing the platform, and must give a reason. A
banned person is signed out and cannot sign in or sign up again with that Google
account. Any flamekeeping ends at once. Bookings not yet picked up are cancelled,
but equipment you already have out must still be returned through the Telegram
bot. Your account and its records are not deleted. An admin can lift the ban, but
that does not restore your sessions or bookings or restart flamekeeping. See the
[Terms of Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md).

---

# Everyone

## Getting Started

### How do I create an account?

Sign in with Google using an `@nu.edu.kz` or `@alumni.nu.edu.kz` account. If
you are new, logging in means you agree to the terms of service and privacy
policy linked on the login page. Your account is ready straight away. You can
browse albums and favorite photos, and you do not need to connect Google Drive.

Returning users just sign in. People who already had an account keep it,
whatever their email.

### Do I have to join the club or become a flamekeeper?

No to both. Joining the club (entering the club code) is only needed to book
equipment and create albums. Flamekeeping is optional and never part of signing
up. Accounts are never removed for being unfinished, so you can come back at any
time. See [Club Members](#club-members) and [Flamekeepers](#flamekeepers).

### Can I delete my account?

If you are not a club member, yes, from your My Account page, once you have
stopped flamekeeping and any photos the Platform stored in your Drive have been
moved. Club members cannot: their accounts and activity records are retained
permanently for equipment accountability. See the [Terms of
Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md).

## Photo Albums

### What are albums?

Albums are photo galleries. Each album is a public folder in the club's Google
storage. You can upload photos directly from your browser.

### Where are my photos stored?

New uploads go to a club-run Google account (the buffer), not to a student's
Google Drive. Your browser uploads straight to Google, and the Platform does not
pass the photos through its own server.

If the club needs extra space, an admin can move an album's photos to
flamekeepers' Drives, and back again. The album's link and your favorites keep
working when photos move. Albums uploaded before the buffer existed remain on
the club's main Google account until an admin moves them.

### Who can see my albums?

Everyone. Every album is public and listed in the public gallery, and its Google
Drive folder is open to anyone with the link (photos load from Google's CDN).
There is no private option, so only upload photos you are happy to have public.

### How do I upload photos?

Open your album and use the upload button. Uploads are tracked in a progress
widget in the site header.

If the club's storage is full, uploads are refused and the site says so. Your
photos stay on your device, and you can tell an admin.

### Can I favorite photos?

Yes, any signed-in user can. A favorite follows the photo if it moves between
accounts.

### Can I share an album with specific people?

Yes, if you are a club member. Every album has an edit share link, and any member
with the link can claim co-author access and upload photos to that album.

### How long do albums last?

There is no automatic expiry. An album stays until it is deleted. Albums more
than two years past their event are marked as ones that may be deleted if
storage runs low.

If the club needs space, an admin can schedule an album for deletion. It is then
deleted after a notice period (14 days by default), and the album's owner and
everyone who favorited a photo in it get a Telegram message, if they have linked
Telegram, so there is time to download what they want. An admin can cancel a
scheduled deletion before the date. An album's owner or an admin can also delete
it at any time. When an album is deleted, its photos are deleted too, and there
is no backup copy.

# Club Members

## Joining the Club

### How do I become a club member?

Enter the club code on your My Account page whenever you are ready. You will
then be asked for your name, date of birth, NU ID, major and graduation month,
and to link your Telegram account. Alumni (`@alumni.nu.edu.kz`) accounts can
join too.

### Why do I need to link Telegram?

Telegram is required for equipment returns and booking notifications. You'll
receive reminders about upcoming bookings, and you use the Telegram bot to
return equipment with photo verification.

### Can I delete my account as a member?

No. Membership is permanent, and your records are kept for equipment
accountability. If you need your account deactivated, contact an administrator.

## Booking Equipment

### How do I book equipment?

1. Browse the **Equipment** catalog. Items you lack clearance for are hidden.
2. Open an item to see its **Availability** calendar and pick one or more
   consecutive 30-minute time slots.
3. You can select **multiple items** from the catalog and book them together —
   the cart persists in `localStorage` and shows all items on a shared
   availability calendar.
4. Confirm the booking. Conflicts are detected server-side.

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

Make sure your Telegram account is linked. Go to your My Account page and check
the Telegram connection status. If it's not linked, use the link provided on
your My Account page to connect.

### The equipment I returned still shows as active

Returns are processed through Telegram. Make sure you completed the full
return flow (including sending the photo). If the issue persists, contact an
administrator.

---

# Flamekeepers

## About Flamekeeping

### What is a flamekeeper?

A flamekeeper is an `@nu.edu.kz` student who pledges part of their own Google
Drive storage to the club as optional reserve capacity (#savenuimg). Flamekeeping
is optional, you do not need it to use the site, and you do not need to be a club
member. Alumni accounts cannot be flamekeepers.

### How do I become a flamekeeper?

Open the Become a flamekeeper page from your My Account page or the one-time
invitation. It takes three short steps. You will be asked for:

- your expected graduation month, which must be in the future,
- your pledge, at least 512 MB (see below),
- nothing else: connecting your Drive means you agree to the [Terms of Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md).

Then connect the Google Drive account with the same `@nu.edu.kz` address you
signed in with. The Platform asks only for access to the files it creates
(`drive.file`).

### Why was my Drive refused?

Your Drive needs room for your pledge under the club's per-account cap (20 GB by
default). If your Drive is already full, or has less free space than your pledge,
free up some space or pick a smaller pledge and try again.

### How much do I need to pledge?

The minimum pledge is 512 MB. The pledge is the most storage the Platform may use
in your Drive. It is a cap on what the Platform uses, not space set aside in
Google. You can change it at any time from your My Account page.

### What does Full mean?

Full means your pledge, or your Drive's room under the cap, has no space left.
It returns to Active by itself when room frees up.

## Photos and Your Drive

### Will my photos be stored in my Drive?

Not unless an admin moves some there. New uploads go to the club's own account.
Your pledge is reserve space: an admin may move an album's photos to flamekeepers
when the club needs room, up to your pledge. That is never automatic, and the
photos can be moved back at any time.

### What can the Platform see in my Drive?

Only the files and folders the Platform creates. It cannot read or change any
other file in your Drive. It also checks how much of your Drive is in use.

### Can I edit or delete the photos the Platform keeps in my Drive?

Please don't. Do not rename, move or delete them, because the Platform manages
them for you. They are owned by you in Google's terms and count against your
Google storage, up to your pledge. The folder is shared with the club's account
so the photos can be copied back.

## Stopping and Graduating

### Can I stop flamekeeping?

Yes, at any time from your My Account page. If the Platform holds none of your
Drive's photos, flamekeeping ends at once. Otherwise you are Draining while the
Platform copies the photos back to the club and deletes them from your Drive. You
do not need to do anything. You can also revoke the Platform's access at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions). See
the [Privacy Policy](https://github.com/sagyzdop/meriksirat/blob/main/docs/privacy-policy.md)
and [Terms of Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md).

### What happens when I graduate?

Flamekeeping ends 60 days before your expected graduation month, and any photos
are moved back to the club first. You are asked once a year to confirm that month
is still right. It also ends if your email stops being `@nu.edu.kz`, or if you are
banned.

### What does Lost mean?

The Platform can no longer reach your Drive, for example because you revoked
access. You have 7 days to reconnect from your My Account page. Meanwhile any
photos in your Drive are copied to the club's account, and your original files
stay until you reconnect, then they are deleted. You get an email about it.
