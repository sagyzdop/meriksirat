# Drains run on the server, with a full-scope token on the buffer only

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

Not built yet, and not verified. Stage 2 of [#15](https://github.com/sagyzdop/meriksirat/issues/15)
waits on live tests: a full drain with real photos, a `drive.file` download of a
buffer file, and finding and copying a lost flamekeeper's photos without their
token. Until those pass, this ADR is a plan.
