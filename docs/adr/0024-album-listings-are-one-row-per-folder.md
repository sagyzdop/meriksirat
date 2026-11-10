# Album listings are one row per folder, not one row per photo

[ADR-0023](0023-photos-are-rows-reconciled-with-drive.md) made the photos rows:
`photo` had one row per file and `photo_source` one row per folder. It fixed the
re-listing cost but moved it into D1. A view read one row per photo, an upload
wrote a row per index, and a listing rewrote every row that differed. D1 bills
rows written, so 298,000 photos was several days of the free plan's 100,000 a
day, and the first bulk backfill would have blocked every write in the app.

`photo` and `photo_source` are gone. One table, `album_listing`
(`src/db/schema.ts`), holds one row per folder an album's photos are listed from,
keyed `(album_id, key)` where `key` is `buffer:{volumeId}`,
`flamekeeper:{volumeId}` or `master` (the album's own folder, which only older
albums have photos in). `folder_id` is the Drive folder, `status` is `ok`,
`partial`, `failed`, `missing` or `unavailable`, `listed_at` and `failed_at` are
the last attempts, and `files` is the JSON array of Drive files as last listed
(name, type, size, checksum, EXIF). A volume is capped at 256 MB
([ADR-0019](0019-256mb-volumes-several-per-holder.md)), which keeps a row far
below D1's 2 MB row limit. The primary key is the only index, because D1 bills
every index entry as a row written.

An album view now reads one row per volume — usually one, at most a handful —
instead of one per photo. Listing a folder writes one row. An upload confirm
appends its file to the folder's row with `json_insert` in one statement, so
parallel uploads cannot overwrite each other, and a delete removes it the same
way; the photo shows at once and the duplicate check sees it. Both do nothing
when the folder was never listed, and the next view lists Drive.

`stamp` is the volume's `expectedCount:expectedBytes` at the moment of the stored
listing, the totals the app itself wrote on upload confirm and delete. It is the
app's own fingerprint of what the folder should hold, so a view can tell the
stored listing is behind without calling Drive. A source is listed when the
stored stamp differs from the current one, when its last listing failed 15
minutes ago, when it was never listed, or when it has not been listed for 7 days.
During an upload burst every confirm changes the stamp, so a source is listed at
most every 5 minutes while uploads arrive and at once after 30 seconds without
one. `master` and legacy flamekeeper volumes have no expected totals, so their
stamp is `''` and they are re-listed by age, failure or Refresh only. While a
listing is behind its stamp the volume raises no "fewer photos than expected"
warning.

A cold load spends at most 40 Drive requests, the Worker run budget
(`src/lib/cron/budget.ts`). A folder it cannot finish is stored `partial` with
the files read so far and listed again 15 minutes later, so an album with more
volumes than one load can list fills in over a few views. The hourly
`reconcileAlbums` step does the same work with what the other steps leave: up to
10 albums not checked for 24 hours, oldest first, so a pass over about 2,200
albums takes roughly two weeks. A listing that found the same files writes only
the small columns and leaves `files` alone, and a source that keeps failing shows
its last files for up to 7 days.

What ADR-0023 decided otherwise stands. A photo's identity is still its current
Drive file id, favorites and covers are still remapped when a photo moves, and a
move still drops the album's rows so the next view lists Drive. Existing albums
need no backfill: one without rows is listed on its first view or by the hourly
step, whichever comes first.

The cost is that `files` is opaque to SQL beyond `json_each` and `json_extract`,
and every change rewrites the whole array of its folder. That is one row per
folder per change instead of one row per photo, which is the point. The rows can
still disagree with Drive for up to 7 days when files change behind the app;
Refresh lists at once.
