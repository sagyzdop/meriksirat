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
A photo gallery: one public folder in the club's master Google Drive account, whose photos are held in volumes on the buffer, and on flamekeepers only after an offload.
_Avoid_: Gallery, collection

**Photo**:
One image in an album, identified by its current Drive file ID, which changes when the photo moves to another account. Listed from Drive and cached, with no photo record of its own.
The photo table was removed in #25 ([ADR-0017](docs/adr/0017-drop-photo-table-read-from-drive.md)). The album row keeps a photo count and byte total that uploads, deletes and complete listings maintain.
_Avoid_: Image, file, picture

**Volume**:
The photos of one album held by one account: the buffer, or a flamekeeper after an offload. One volume per album per account. Stores the expected count and bytes, which the count warning checks against (see `docs/scenarios/albums/fewer-photos-warning.md`).
All volumes live in the `volume` table. The buffer's volume is the row with no flamekeeper (`flamekeeper_user_id` is NULL), one per album, and carries the expected count and bytes. Flamekeeper rows from before the buffer keep those NULL and never warn. Offload (Stage 2) is the only thing that will create new ones.
_Avoid_: Chunk, shard, part

**Favorite**:
A photo a user has saved, keyed by user, album and Drive file ID. Moving a photo remaps its favorites and the album cover to the new file ID, through one shared remap that drains and offloads reuse. A Favorite whose photo no longer exists is left out of the lists, without an error. Albums with favorites come after albums without them in the deletion suggestions.
_Avoid_: Bookmark, like, star

**Expiry**:
The date an album is deleted, by default two years after its event; shown on every unpinned album page, with a warning in its last 30 days. Expiry lists each volume fresh with its owner token and deletes what it finds; an unreachable flamekeeper's files are left in place.
_Avoid_: TTL, deletion deadline

**Pin**:
An admin's mark that keeps an album past its expiry for as long as there is space.
_Avoid_: Keep, archive

**Tombstone**:
The page an album's URL shows once the album has been deleted, saying why. An admin can delete an album whose folder is permanently gone, leaving a tombstone.
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
The health of an album's Drive folder: `ok`, `trashed` (in the Drive bin), or `missing` (permanently gone). A `trashed` or `missing` folder shows a warning with a Drive link; the app never restores or recreates it.
_Avoid_: Album state, drive status

### Save NU Image (#savenuimg)

**Member**:
A user who unlocked membership with the club code; only members can book equipment and create albums. Permanent.
_Avoid_: Club user, regular user

**Alumnus**:
A user with an `@alumni.nu.edu.kz` account. Can favorite photos and enter the club code, but can't be a flamekeeper.
_Avoid_: Graduate, when the account rather than the member status is meant

**Terms acceptance**:
A new user ticks the terms on the login page before Google sign-in. The date is saved on the user (`termsAcceptedAt`) when the account is created, and the account is finished at once. Accounts are never removed for being unfinished. Accounts that existed before this are not asked again.
_Avoid_: Signup step, registration

**Club code**:
The single, rotatable code a user enters to become a member.
_Avoid_: Invite code, password

**Buffer**:
The club-run Google account, `nuimage.storage@gmail.com`, on a 5 TB plan. New album photos are uploaded to it, and photos leaving a flamekeeper are copied back to it. It holds a `drive.file` token for uploads and a full-scope token that only the server uses, for drains. It is not a flamekeeper.
Uploads go to it as of #17. Copying photos onto the buffer from flamekeepers is Stage 2 and not built yet.
Usage is read from the Drive quota with the `drive.file` token. At 90% admins get one Telegram warning per crossing and `@nu.edu.kz` users see a banner asking for flamekeepers, with no mention of storage. At 100% uploads are refused with a plain message and the files stay in the uploader's browser (#26, [scenario](docs/scenarios/cron/flamekeepers/buffer-usage.md)). Setup is in the README, "Connecting the buffer account".
_Avoid_: Storage account, main account, master

**Flamekeeper**:
An `@nu.edu.kz` user who pledges optional reserve storage from their Google Drive to the club. Holds no photos when they sign up, since new uploads go to the buffer; they hold photos only after an admin offloads some to them. May also be a member.
Not built yet: offload is Stage 2 (#15), so until then a flamekeeper's Drive grant sits unused. Uploads no longer go to flamekeepers (#17), and the old placement, drain and relay code was removed in #24; the last `dev` commit containing it is `2565826`. Stopping, graduating, a domain change and a ban end flamekeeping at once, dropping the grant, because nothing is held.
_Avoid_: Donor, contributor, host

**Pledge**:
The maximum GB a flamekeeper lets the app use, at least 512 MB. A cap on what the app uses, not space set aside in Google.
_Avoid_: Allocation, quota

**Pool**:
The total free pledged space across all active flamekeepers, used only to pick offload destinations. Uploads never use the pool; they go to the buffer, and stop when the buffer is full.
Not built yet (Stage 2): offload is the only user of the pool.
_Avoid_: Storage, capacity

**Draining**:
A flamekeeper state in which the server copies their photos to the buffer, before they leave or graduate. The flamekeeper's own token then deletes the originals, and the drain is one-way.
Not built yet (Stage 2, #15). Until then nothing is held on a flamekeeper, so the code that drained through the browser relay (ADR-0009) was removed in #24 (last `dev` commit containing it: `2565826`) and ending flamekeeping is immediate. The `drained` state now simply means "stopped"; the old `draining` state is only found on rows left by earlier code, which the hourly `drainFlamekeepers` step ends.
_Avoid_: Evacuating, migrating

**Relay**:
Moving one photo through a browser: downloaded with a short-lived `drive.file` token and uploaded into the album's volume for the destination. The photo gets a new Drive file ID (ADR-0009, amended by ADR-0016).
Under the new design, relay is used only by an admin-started offload, from the buffer to a flamekeeper, in the admin's browser. Drains no longer use it.
Not built yet (Stage 2): no relay exists in the code. The old drain relay was removed in #24 (last `dev` commit containing it: `2565826`).
_Avoid_: Transfer, copy

**Lost flamekeeper**:
A flamekeeper whose Drive access can no longer be refreshed; they can reconnect from their profile at any time. Under the Stage 2 design their photos drop out of the app after 7 days and return if they reconnect, however late. If the rescue test passes, the buffer copies their photos during those 7 days. Their original files stay in their Drive either way.
Not built yet (Stage 2): the rescue test has not been run (#15). Today nothing is held, so a lost flamekeeper loses nothing and the 7 days only time the reconnect email.
_Avoid_: Revoked, disconnected

**Banned user**:
A user an admin has shut out for abusing the platform. They can no longer sign in, can't sign up again with that Google account, and any flamekeeping they have ends at once.
_Avoid_: Blocked, suspended

### Notifications

**Audit channel**:
The Telegram channel that receives booking and album activity logs.
_Avoid_: Log channel

**Reminder**:
One of four automatic Telegram notices tied to a booking's timeline: pre-start, start-time, end-time, and grace.
_Avoid_: Alert, notification
