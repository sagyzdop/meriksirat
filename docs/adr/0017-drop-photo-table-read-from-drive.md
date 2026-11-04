# Drop the photo table; read photos from Drive and cache the listings

The `photo` table, its backfill and the `dropped` state are removed. The table
existed so the app could keep a stable photo ID and delete photos with their
owner's token. Photos now sit on the buffer or on a flamekeeper, and the app
lists each volume's parent folder with its owner's token and caches the result
in KV. A reconnected flamekeeper's photos return once listing works again. No
API key is used.

A photo's identity is its current Drive file ID. It changes when the photo moves,
so moving a photo remaps the favorites and the album cover. Favorites are keyed
by `(user_id, album_id, drive_file_id)`. Listed files are the source of truth, so
files added by hand in Drive don't appear.

The count warning replaces the table's bookkeeping. It compares each listing with
the volume's expected count and bytes, on listing and on the health check. Owners
and admins see it. Admins also see the volume link and flamekeeper. An Accept
action sets the new expected values, so a deliberate removal stops raising it.

Dedupe compares size first, and hashes only when sizes match. Filenames are
ignored.

Consequence: a lost flamekeeper's photos still can't be deleted by the app, as in
[ADR-0008](0008-one-club-folder-per-album-photos-owned-by-flamekeepers.md). They
drop out of the app, which is why an album folder can't be deleted while they
exist. Deleted folders become a warning with a Drive link, and an admin may delete
an album that is permanently gone.

## The listing cache

Each album has one KV entry, `album:list:{album folder id}`, with one section per
source: `buffer`, `master` and `flamekeeper:{user id}`. One entry means one KV
write per refresh however many volumes an album has, which matters on the free
plan's 1,000 writes a day. The master section exists because older albums' photos
still sit in the album's root folder on master until they are moved. A lost
flamekeeper keeps its section, and its last listing is shown for up to 7 days.

A section is listed again after 12 hours, or after 15 minutes if the last attempt
failed or was cut short. The entry expires after 8 days. A cold load spends at
most 40 Drive requests, the Worker's run budget, and whatever it could not finish
is marked incomplete and finished by a later view. Over budget or failing sections
keep their last listing, so the album page always opens.

Uploads don't write to KV. The buffer section stores the volume's expected count
and bytes as a stamp, and the view compares it with a fresh read of `buffer_volume`,
so confirming an upload makes the next view list the buffer again. A KV delete per
photo would spend the daily quota on one large upload. Photo deletions, moves and
Refresh do touch KV. Refresh overwrites the entry and keeps the last listing if
Drive fails.

A listing that is not `complete` says nothing about what is missing, so the expiry
and count-warning tickets must not act on one.

## Status

Album pages read from these listings since [#18](https://github.com/sagyzdop/meriksirat/issues/18). Upload dedupe reads them too since [#20](https://github.com/sagyzdop/meriksirat/issues/20); the browser hashes a file only when a listed file has its size.
Album expiry works from listings since [#21](https://github.com/sagyzdop/meriksirat/issues/21). It lists each volume fresh with its owner token and ignores the cache, and only a complete listing followed by successful deletes lets it tombstone. See `docs/scenarios/cron/albums-and-housekeeping/expiry-delete.md`.
The rest is not built yet. Stage 1 of [#15](https://github.com/sagyzdop/meriksirat/issues/15)
removes the table. Until then, [ADR-0008](0008-one-club-folder-per-album-photos-owned-by-flamekeepers.md)
describes favorites, expiry and flamekeeper moves, which still use the table.
