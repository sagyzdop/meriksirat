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
A photo gallery whose photos live in a folder in the club's shared master Google Drive account.
_Avoid_: Gallery, collection

**Album owner**:
The member who created an album.
_Avoid_: Creator, author

**Co-author**:
A member granted edit rights on someone else's album by presenting its edit link.
_Avoid_: Editor, collaborator, member

**Album manager**:
An admin or manager, who may act on any album.
_Avoid_: Admin, when the album context is meant

**Shared album**:
An album reachable through its public view link. Sharing controls app visibility only, never Drive permissions.
_Avoid_: Public album, private album

**Folder state**:
The health of an album's Drive folder: `ok`, `trashed` (in the Drive bin), or `missing` (permanently gone).
_Avoid_: Album state, drive status

### Notifications

**Audit channel**:
The Telegram channel that receives booking and album activity logs.
_Avoid_: Log channel

**Reminder**:
One of four automatic Telegram notices tied to a booking's timeline: pre-start, start-time, end-time, and grace.
_Avoid_: Alert, notification
