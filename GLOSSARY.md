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
A member's club standing: Active, Inactive, or Alumni. Separate from flamekeeper state and from a ban ([ADR-0020](docs/adr/0020-member-status-separate-from-flamekeeper-state-and-ban.md)).
_Avoid_: User state

### Albums

**Album status**:
Derived, never stored, with six values. Precedence: Lost, Deleted, Scheduled for deletion, Rescued, Unhealthy, Healthy ([ADR-0018](docs/adr/0018-album-status-is-derived-with-six-statuses.md)). Lost is a deletion whose reason is a lost or departed flamekeeper or a deleted Drive folder. Unhealthy means a live volume sits on a lost or partially lost flamekeeper.
_Avoid_: Album state (that is **Folder state**)

**Storage holder**:
Who holds an album's live volumes: the buffer or flamekeepers, never both.
_Avoid_: Owner, location

**Album**:
A photo gallery: one public folder in the club's master Google Drive account, whose photos are held in volumes on the buffer, and on flamekeepers only after an offload.
_Avoid_: Gallery, collection

**Photo**:
One image in an album, identified by its current Drive file ID, which changes when the photo moves to another account. Listed from Drive and cached, with no photo record of its own.
The photo table was removed in #25 ([ADR-0017](docs/adr/0017-drop-photo-table-read-from-drive.md)). The album row keeps a photo count and byte total that uploads, deletes and complete listings maintain.
_Avoid_: Image, file, picture

**Volume**:
The photos of one album held by one account: the buffer, or a flamekeeper after an offload. A volume holds at most 256 MB (`VOLUME_MAX_BYTES`); an upload that would exceed it opens another volume, so an album can have several per account. Stores the expected count and bytes, which the count warning checks against (see `docs/scenarios/member/albums/warnings.md`).
All volumes live in the `volume` table. The buffer's volumes are the rows with no flamekeeper (`flamekeeper_user_id` is NULL) and carry the expected count and bytes. Flamekeeper rows are created only by an offload and carry the expected values too; legacy rows from before the buffer keep them NULL and never warn. A row with `dropped_at` set is no longer live: its files are originals or partial copies waiting to be deleted.
_Avoid_: Chunk, shard, part

**Favorite**:
A photo a user has saved, keyed by user, album and Drive file ID. Moving a photo remaps its favorites and the album cover to the new file ID, through one shared remap that drains and offloads reuse. A Favorite whose photo no longer exists is left out of the lists, without an error. Everyone who favorited a photo in an album gets its scheduled-deletion notice.
_Avoid_: Bookmark, like, star

**Scheduled deletion**:
The date an admin sets for an album to be deleted: the day it is scheduled plus the Settings value "album deletion notice days" (default 14). The owner and everyone who favorited a photo in the album get a Telegram notice with the date (if they have linked Telegram), an admin can cancel it before then, and the hourly `deleteScheduledAlbums` step deletes it afterwards. An owner or album manager can also delete an album at once. There is no automatic expiry and no pin: nothing is deleted without an admin acting. An album whose event is over two years old only shows a warning that it may be deleted if storage runs low. Deleting lists each volume fresh with its owner token and deletes what it finds; an unreachable flamekeeper's files are left in place.
_Avoid_: Expiry, TTL, deletion deadline

**Tombstone**:
The page an album's URL shows when its photos were lost rather than deleted on purpose, saying why. Today that is only a Drive folder that is permanently gone (an admin removes such an album); the `flamekeeper_left` and `flamekeeper_lost` reasons are still displayed but nothing creates them any more, since drains copy photos back to the buffer instead of deleting them. An album deleted by its owner, an admin or a scheduled deletion is removed entirely and leaves no tombstone.
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
The login page states that logging in means agreeing to the Terms of Service and Privacy Policy, with links; there is no checkbox. The date is saved on the user (`termsAcceptedAt`) when the account is created, and the account is finished at once. Accounts are never removed for being unfinished. Accounts that existed before this are not asked again.
_Avoid_: Signup step, registration

**Club code**:
The single, rotatable code a user enters to become a member.
_Avoid_: Invite code, password

**Buffer**:
The club-run Google account (today `nuimage.storage@gmail.com`, on a 5 TB plan) that an admin connects in Settings > Storage. New album photos are uploaded to it, and photos leaving a flamekeeper are copied back to it. One full-scope token, stored encrypted and used only by the server, does uploads, reads and drains ([ADR-0021](docs/adr/0021-buffer-account-is-a-stored-grant.md)). It is not a flamekeeper and cannot sign in. Switching it copies every album to the new account first.
Uploads go to it as of #17. Photos come back to it from flamekeepers by Move to Buffer, a drain or the rescue of a lost flamekeeper, copied with the buffer token.
Usage is read from the Drive quota. At 90% admins get one Telegram warning per crossing and `@nu.edu.kz` users see a banner asking for flamekeepers, with no mention of storage. At 100% uploads are refused with a plain message and the files stay in the uploader's browser (#26, [scenario](docs/scenarios/kv/buffer-usage.md)). Setup is in the README, "Connecting the buffer account".
_Avoid_: Storage account, main account, master

**Flamekeeper**:
An `@nu.edu.kz` user who pledges optional reserve storage from their Google Drive to the club. Holds no photos when they sign up, since new uploads go to the buffer; they hold photos only after an admin offloads some to them. May also be a member.
Uploads never go to flamekeepers (#17). Stopping, graduating, a domain change and a ban end flamekeeping at once when nothing is held; otherwise the flamekeeper is Draining until their photos are back on the buffer. Full means their pledge or the per-account cap leaves no room; it returns to Active when room frees up.
Flamekeeper status shown to admins: Active, Full, Draining, Lost, Stopped (the `drained` state), or Banned. The state is system-managed and read-only for admins; Banned overrides it, since a ban is account-wide. Not the same as **Member status**.
Flamekeeper listings key their sources as `flamekeeper:<volumeId>` and `buffer:<id>`.
_Avoid_: Donor, contributor, host

**Pledge**:
The maximum GB a flamekeeper lets the app use, at least 512 MB. A cap on what the app uses, not space set aside in Google.
_Avoid_: Allocation, quota

**Pool**:
The total free pledged space across all active flamekeepers, used only to pick offload destinations. The pool-low alert fires when "% used" reaches the admin setting (default 90), which the hourly `maintainPool` step reads. Uploads never use the pool; they go to the buffer, and stop when the buffer is full.
Offload is the only user of the pool.
_Avoid_: Storage, capacity

**Draining**:
A flamekeeper state in which the server copies their photos to the buffer, before they leave or graduate. The flamekeeper's own token then deletes the originals, and the drain is one-way.
The hourly `drainFlamekeepers` step does it a few albums per run and stops the flamekeeper once no volume row of theirs is left. The `drained` state means "stopped".
_Avoid_: Evacuating, migrating

**Relay**:
Moving one photo through a browser: downloaded with a short-lived `drive.file` token and uploaded into the album's volume for the destination. The photo gets a new Drive file ID (ADR-0009, amended by ADR-0016).
Under the new design, relay is used only by an admin-started offload, from the buffer to a flamekeeper, in the admin's browser. Drains no longer use it.
Built in `src/lib/albums/offload-client.ts`: the browser downloads with the buffer's `drive.file` token and uploads to resumable URLs the server mints with the flamekeeper's token.
_Avoid_: Transfer, copy

**Lost flamekeeper**:
A flamekeeper whose Drive access can no longer be refreshed; they can reconnect from their profile at any time. Their volumes can no longer be listed, so the app shows their last listing for up to 7 days, while the hourly drain step copies the photos to the buffer with the full-scope token, which reads the volume folders shared with the buffer. Their original files stay in their Drive and are deleted once they reconnect.
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
