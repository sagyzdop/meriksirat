# There is no backup; deleted albums are gone

> **Amended by [ADR-0015](0015-buffer-is-stable-photo-storage.md),
> [ADR-0016](0016-drains-run-on-server-with-buffer-full-token.md) and
> [ADR-0017](0017-drop-photo-table-read-from-drive.md), and superseded in part
> by the removal of automatic expiry.**
> There is no backup, and that still holds. Albums no longer expire, there are
> no pins and no suggested deletions: an album is deleted only when its owner or
> an admin deletes it, or when an admin schedules it for deletion (notice of 14
> days by default, to the owner and everyone who favorited, cancellable; see
> [GLOSSARY](../../GLOSSARY.md), Scheduled deletion). A full buffer pauses a
> drain and warns admins; it never deletes photos. Uploads stop at a full buffer
> and never fall back to flamekeepers. Drains copy photos back to the buffer rather than deleting them. The
> tombstone page is now created only for folders that are permanently gone,
> which an admin may remove. The text
> below is the original decision, kept for history; its expiry, pin, reminder
> and suggested-deletion parts are no longer true.

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
