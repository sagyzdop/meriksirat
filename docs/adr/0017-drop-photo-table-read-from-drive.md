# Drop the photo table; read photos from Drive and cache the listings

> **Amended by [ADR-0022](0022-caches-and-flow-state-in-d1.md) and [ADR-0023](0023-photos-are-rows-reconciled-with-drive.md).**
> Nothing is in KV any more, and photos are rows in D1 again (`photo`, `photo_source`),
> written on upload and delete and reconciled with Drive hourly. Photo identity,
> the remap on moves and the count warning below still hold. The text below is the
> original decision, kept for history.

The `photo` table, its backfill and the `dropped` state are removed. The table
existed so the app could keep a stable photo ID and delete photos with their
owner's token. Photos now sit on the buffer or on a flamekeeper, and the app
lists each volume's parent folder with its owner's token and caches the result
in KV. A reconnected flamekeeper's photos return once listing works again. No
API key is used.

A photo's identity is its current Drive file ID. It changes when the photo moves,
so moving a photo remaps the favorites and the album cover. Favorites are keyed
by `(user_id, album_id, drive_file_id)`. One shared remap, `remapDriveFile` in
`src/lib/favorites/remap-server.ts`, does the re-pointing for offload and
drain. Listed files are the source of truth, so files added by hand in Drive
don't appear.

The count warning replaces the table's bookkeeping. It compares each listing with
the volume's expected count and bytes, on listing. No Stage 1 health check reads
buffer volumes, so the health check does not raise it yet. Owners
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
and bytes as a stamp, and the view compares it with a fresh read of the buffer's `volume` row.
A changed stamp makes the buffer due for listing, but during an upload burst a view
lists it at most once every 5 minutes, and lists at once when no upload was confirmed
in the last 30 seconds, so a finished batch shows up promptly. While the cached
listing is behind the stamp, the volume raises no fewer-photos warning. The upload
duplicate check always lists a stale-stamped buffer fresh and does not store the
result, so it sees files uploaded moments ago without a KV write. A KV delete per
photo would spend the daily quota on one large upload. Photo deletions, moves and
Refresh do touch KV. Refresh overwrites the entry and keeps the last listing if
Drive fails.

A listing that is not `complete` says nothing about what is missing, so the expiry
and count-warning tickets must not act on one.

## One volume table

#17 first stored the buffer's volumes in a separate `buffer_volume` table, next to the older flamekeeper `volume` table that had no expected count or bytes. The spec asks for one table, so that split is gone. Since migration 0037 there is one `volume` table. A row whose
`flamekeeper_user_id` is NULL is a buffer volume (an album can have several, each at most 256 MB; [ADR-0019](0019-256mb-volumes-several-per-holder.md)); its expected count and bytes are filled. Legacy
flamekeeper rows keep NULL expected values and never raise the warning.
`expected_changed_at` records the last confirm or delete, so the listing can tell
an upload burst from a quiet album.

## Status

Album pages read from these listings since [#18](https://github.com/sagyzdop/meriksirat/issues/18). Upload dedupe reads them too since [#20](https://github.com/sagyzdop/meriksirat/issues/20); the browser hashes a file only when a listed file has its size.
Album deletion works from listings since [#21](https://github.com/sagyzdop/meriksirat/issues/21). It lists each volume fresh with its owner token and ignores the cache, and only a complete listing followed by successful deletes lets the album row go. See [delete-album](../scenarios/member/albums/delete-album.md).
The table, its backfill and the `dropped` photo state were removed in [#25](https://github.com/sagyzdop/meriksirat/issues/25), along with the columns and tables only they or the old drain and reservation code used (`album.photos_index*`, the flamekeeper drain columns, `health_cursor`, `leaderboard_anonymous`, the volume release-blocked columns and `upload_reservation`). The `volume.dropped_at` column stays, since the listing uses it.

Deleting a photo or setting a cover is authorized by the listing: the file id must be listed in that album's own folders, which are read with each owner's token, and the listing says whose token acts on it. A cached listing that misses the file is refreshed once. A file id from another album or any other Drive file is refused before any token is used.

`album.photo_count` and `photo_bytes` stay. Confirming an upload adds to them, deleting a photo subtracts, and a complete listing of every volume replaces them with the exact totals.
