# Photos are rows in D1, reconciled with Drive in the background

[ADR-0017](0017-drop-photo-table-read-from-drive.md) removed the photo table and
made a cached Drive listing the only record of an album's photos. The app is the
only writer of those photos, so it was re-discovering in Drive what it had just
done, and paying for it on page views: a view listed Drive whenever the cache was
12 hours old, a delete threw the whole listing away, every upload session listed
the buffer for the duplicate check, and the listing was one large blob rewritten
on any change.

Photos are rows again. `photo` has one row per file and `photo_source` one row
per folder they are listed from, with the state of its last listing
(`src/lib/albums/photo-store.ts`). An upload inserts its row at confirm and a
delete removes it. Views read the rows. Listing Drive is now reconciliation: the
hourly `reconcileAlbums` step lists each album about once a day with the budget
the other steps leave, and a view lists only what the rules in `listing.ts`
still call due (a changed volume stamp, a failed listing, a source never listed,
or one the hourly step has not reached for 7 days). A listing writes only the
rows that differ.

What ADR-0017 decided otherwise stands. A photo's identity is still its current
Drive file id, favorites and covers are still remapped when a photo moves, and a
move still drops the album's rows so the next view lists Drive. Giving photos a
stable id, so that a move updates a row instead, is the next step and is not
done. The count warning, the stamps and the 7-day last-listing rule for a lost
flamekeeper are unchanged; they read the same data from rows.

Existing albums need no backfill: an album without rows is listed on its first
view or by the hourly step, whichever comes first.

The cost is that the rows can disagree with Drive for up to a day when files
change behind the app, where the old design noticed within 12 hours of a view.
Refresh still lists at once.
