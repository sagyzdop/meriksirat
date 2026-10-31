# There is no backup; albums expire and leave a tombstone

There is no second copy of any photo. When a volume can't be moved (its
flamekeeper is lost, draining ran out of time, or the pool is full), its albums
are deleted, and the album URL shows a tombstone page explaining what happened
instead of breaking. Every album has an expiry date (by default two years after
the event) shown in the UI, with reminders 30 and 7 days before. Only admins can
keep an album longer, by pinning it. When the pool is full, admins get suggested
deletions ranked by soonest expiry, then by size; an early expiry gives a 7-day
notice. Expiry is the only automatic deletion: running out of space blocks
uploads but never deletes albums early.
