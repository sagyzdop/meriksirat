# There is no backup; albums expire and leave a tombstone

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
