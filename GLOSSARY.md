# Meriksirat

Meriksirat is NU Image's equipment-booking and photo-album platform. This glossary
fixes the vocabulary used across the code, docs, and issues.

## Language

### Bookings

**Booking**:
A member's reservation of one or more pieces of equipment for a single time range.
_Avoid_: Order, rental, reservation

**Booking item**:
One piece of equipment inside a booking, with its own lifecycle and status. A booking holds one item per equipment.
_Avoid_: Line item, booking row

**Booked**:
A booking or item that is reserved but not yet picked up. The only state that can be cancelled.
_Avoid_: Reserved, pending, scheduled

**Active**:
An item that has been picked up and not yet returned.
_Avoid_: In use, ongoing, checked out

**Returned**:
An item that has been given back. A booking is `returned` once every non-cancelled item is returned.
_Avoid_: Completed, done, closed

**Partially returned**:
A booking with some items returned and at least one still out. A booking status only, never an item status.
_Avoid_: Partially complete

**Overdue**:
An item still out more than 15 minutes past the booking's end time.
_Avoid_: Late, past due

**Cancelled**:
A booking or item that was never picked up and has been called off — by the member, an admin, or the no-show job.
_Avoid_: Aborted, voided, deleted

**Derived status**:
A booking's status, always recomputed from its items' statuses and never set directly.
_Avoid_: Parent status, computed state

**Start window**:
The 15 minutes before to 15 minutes after a booking's start time, during which pickup may be confirmed.
_Avoid_: Pickup window, check-in window

**Grace period**:
The 15 minutes after a booking's end time before its items become overdue.
_Avoid_: Overtime, buffer

**No-show**:
A booking auto-cancelled because pickup was never confirmed within the start window; counted once per booking against the member.
_Avoid_: Missed pickup, auto-cancel

**Overdue forgiveness**:
Reverting overdue items to active when an extension pushes the end time into the future; the member's overdue count drops by one.
_Avoid_: Overdue reset

**Extension**:
A 30-minute addition to a booking's end time, allowed only while the next slot is free.
_Avoid_: Prolongation, renew

### Equipment & access

**Equipment**:
A bookable physical asset, identified by a model name and backed by a dedicated Google Calendar.
_Avoid_: Item, device, asset

**Category**:
A grouping of equipment used for catalog filtering.
_Avoid_: Type, tag

**Clearance level**:
A number on both members and equipment that gates who may book what; 10 is the most restrictive.
_Avoid_: Permission level, access tier

**Role**:
A member's permission tier: `user`, `manager`, or `admin`.
_Avoid_: Type

**Member status**:
A member's club standing: Active, Inactive, On Probation, Board, Ex-Board, Roommate, Ex-Roommate, or Graduated.
_Avoid_: User state

### Albums

**Album**:
A photo gallery: one public folder in the club's master Google Drive account, whose photos are owned by flamekeepers.
_Avoid_: Gallery, collection

**Photo**:
One image in an album, with a stable ID of its own and a current Drive file ID that changes when the photo moves.
_Avoid_: Image, file, picture

**Volume**:
The photos of one album held by one flamekeeper. A database grouping, never a Drive folder.
_Avoid_: Chunk, shard, part

**Favorite**:
A photo a user has saved. Albums with favorites come after albums without them in the deletion suggestions.
_Avoid_: Bookmark, like, star

**Expiry**:
The date an album is deleted, by default two years after its event; shown on the album in its last 30 days.
_Avoid_: TTL, deletion deadline

**Pin**:
An admin's mark that keeps an album past its expiry for as long as there is space.
_Avoid_: Keep, archive

**Tombstone**:
The page an album's URL shows once the album has been deleted, saying why.
_Avoid_: Dead link, 404

**Album owner**:
The member who created an album.
_Avoid_: Creator, author

**Co-author**:
A member granted edit rights on someone else's album by presenting its edit link.
_Avoid_: Editor, collaborator, member

**Album manager**:
An admin or manager, who may act on any album.
_Avoid_: Admin, when the album context is meant

**Folder state**:
The health of an album's Drive folder: `ok`, `trashed` (in the Drive bin), or `missing` (permanently gone).
_Avoid_: Album state, drive status

### Save NU Image (#savenuimg)

**Member**:
A user who unlocked membership with the club code; only members can book equipment and create albums. Permanent.
_Avoid_: Club user, regular user

**Alumnus**:
A user with an `@alumni.nu.edu.kz` account. Can favorite photos and enter the club code, but can't be a flamekeeper.
_Avoid_: Graduate, when the account rather than the member status is meant

**Club code**:
The single, rotatable code a user enters to become a member.
_Avoid_: Invite code, password

**Flamekeeper**:
An `@nu.edu.kz` user who lends part of their Google Drive storage to hold volumes. May also be a member.
_Avoid_: Donor, contributor, host

**Pledge**:
The maximum GB a flamekeeper lets the app use, at least 1 GB. A cap on what the app uses, not space set aside in Google.
_Avoid_: Allocation, quota

**Pool**:
The total free space across all active flamekeepers.
_Avoid_: Storage, capacity

**Draining**:
A flamekeeper state in which their photos are being moved to other flamekeepers, through the browser, before they leave or graduate.
_Avoid_: Evacuating, migrating

**Relay**:
Moving one photo through a browser: downloaded with the source flamekeeper's token and uploaded into the same album folder for the destination, keeping the photo's ID (ADR-0009).
_Avoid_: Transfer, copy

**Lost flamekeeper**:
A flamekeeper whose Drive access can no longer be refreshed; their photos drop out of the app after 7 days and return if they reconnect, however late.
_Avoid_: Revoked, disconnected

**Banned user**:
A user an admin has shut out for abusing the platform. They can no longer sign in, can't sign up again with that Google account, and any photos they hold are drained.
_Avoid_: Blocked, suspended

### Notifications

**Audit channel**:
The Telegram channel that receives booking and album activity logs.
_Avoid_: Log channel

**Reminder**:
One of four automatic Telegram notices tied to a booking's timeline: pre-start, start-time, end-time, and grace.
_Avoid_: Alert, notification
