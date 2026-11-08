# Drains run on the server, with a full-scope token on the buffer only

> **Amended by #24.** The relay, drain and placement code described below was
> removed because nobody holds photos on a flamekeeper until Stage 2. The last
> `dev` commit containing it is `2565826`; Stage 2 tickets restore what they need
> from the commit history. Offload and the server-side drain have since been
> rebuilt; see [the storage scenario](../scenarios/admin/albums/storage.md).

A drain moves a leaving flamekeeper's photos to the buffer. It runs in the hourly
cron on the server, not in the flamekeeper's browser. Under `drive.file` the
server can't read or copy another account's files, so the buffer alone gets a
full-scope `drive` token, stored on the server. The master and flamekeeper
tokens stay `drive.file` ([ADR-0009](0009-drive-file-only-photos-move-through-browser.md),
[ADR-0013](0013-drive-grant-stored-apart-from-login.md)).

The full token never reaches a browser, so a browser compromise can't expose the
whole account. It uses the same production OAuth client, and the spec accepts one
unverified account consent. The flamekeeper's own token only lists and deletes
files; it never copies them.

This reopens the cost [ADR-0009](0009-drive-file-only-photos-move-through-browser.md)
avoided. Google's restricted-scope review and paid assessment would apply to the
app's whole OAuth client, not just one account. Google verification of the app
is out of scope for #15, so if Google requires it, this ADR must be reopened.

Copies are verified by size and MD5, and a repeated run skips files already
copied, matched by MD5. A full buffer pauses the drain and warns admins, rather
than deleting photos. The 14-day deletion applies only when the flamekeeper's
own access is what blocks the drain
([ADR-0012](0012-no-backup-albums-expire.md)).

Offload, the admin-started move from the buffer to a flamekeeper, keeps the full
token on the server. The browser gets only a short-lived `drive.file` buffer
token for the download. See [GLOSSARY.md](../../GLOSSARY.md#save-nu-image-savenuimg)
for Relay.

Built in `src/lib/albums/storage-server.ts` (`rescueAlbumVolume`) and
`src/lib/pool/drain-cron.ts`. The copies are staged and made live in one batch;
the originals are deleted afterwards with the owner's token, or once a lost owner
reconnects. Before trusting a listing, the rescue checks that the buffer can read
the volume folder and, when the owner is reachable, sees every file the owner
sees.
