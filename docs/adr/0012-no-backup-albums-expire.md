# There is no backup; albums expire and leave a tombstone

> **Amended by [ADR-0015](0015-buffer-is-stable-photo-storage.md),
> [ADR-0016](0016-drains-run-on-server-with-buffer-full-token.md) and
> [ADR-0017](0017-drop-photo-table-read-from-drive.md).**
> A full buffer pauses a drain and warns admins; it never deletes photos. Uploads
> stop at a full buffer and never fall back to flamekeepers, so "the pool is full"
> now means the buffer is full. The 14-day deletion applies only when a
> flamekeeper's own access blocks the drain. Deleted folders become a warning with
> a Drive link, and an admin may delete an album that is permanently gone. The
> rest still holds: expiry, pins, suggested deletions and the Free up space panel,
> and expiry is still the only automatic deletion. The text below is the original
> decision, kept for history.

There is no second copy of any photo. When a volume can't be moved (draining ran
out of time, or the pool is full), its photos are deleted; a lost flamekeeper's
photos drop out of the app. An album left with no photos shows a tombstone page
at its URL explaining what happened, instead of breaking. Every album has an
expiry date (by default two years after the event) shown in the UI, with
reminders 30 and 7 days before. Only admins can keep an album longer, by pinning
it. When the pool is full, admins get suggested deletions: albums nobody
favorited come before favorited ones, and each group is ranked by soonest
expiry, then largest size. An early expiry gives the owner and everyone who
favorited a photo in the album 7 days' notice. Expiry is the only automatic
deletion: running out of space blocks uploads but never deletes albums early.
