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

Not built yet. Stage 1 of [#15](https://github.com/sagyzdop/meriksirat/issues/15)
removes the table. Until then, [ADR-0008](0008-one-club-folder-per-album-photos-owned-by-flamekeepers.md)
describes the running code.
