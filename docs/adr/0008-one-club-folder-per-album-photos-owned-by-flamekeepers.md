# One club folder per album; photos are owned by flamekeepers in volume subfolders

The university capped every account at 20GB, so the club's master account can no
longer pay for album photos. Each album is still a single public folder in the
master account (ADR-0005 holds unchanged), but every photo in it is uploaded
with a flamekeeper's own `drive.file` token. A photo is owned by whoever uploads
it, so it counts against that flamekeeper's quota while it inherits the
folder's "anyone" reader permission and is served from Google's CDN as before
(verified by the #savenuimg spike).

A **volume** (the photos of one album held by one flamekeeper) is a Drive
subfolder of the album folder. The master account creates it, empty, named
`Volume <short id>` with no personal data since album folders are public, and
shares it with that flamekeeper; the flamekeeper uploads into it. The first
version shared the album folder itself and kept a volume as only a database
grouping. That broke: under `drive.file` the master token can't change
permissions on a folder that holds another account's files (`403
appNotAuthorizedToChild`), so adding a second flamekeeper to an album failed as
soon as the first one's photos were in it. Sharing a new, empty subfolder always
works. The same rule means a flamekeeper's access can only be removed, and the
subfolder deleted, once the volume has no photos left, and the master can
delete an album folder only after every photo in it is gone.

One side effect: a flamekeeper can write only to their own subfolder, not to
other flamekeepers' photos.

Because `drive.file` lets each account see only the files it created, the master
token can't list or delete flamekeepers' photos. The app keeps a photo table
(stable photo ID, current Drive file ID, volume, bytes) written at upload, and
deletes each photo with its owner's token before deleting the folder. The photo
ID stays the same when a photo moves to a new Drive file, so favorites survive
the move. A lost flamekeeper's photos can't be deleted by the app and keep the
album folder from being deleted: they drop out of the app but stay public in
Drive until their owner removes them. The master account must stay able to
create folders, so it has to get back under its own cap.

When a relay leaves the original photo in the source flamekeeper's Drive, the
volume's subfolder can't be deleted. The app then lists that subfolder with the
flamekeeper's own token and deletes the files no photo row needs, and after 7
days of being blocked the volume stops holding up the flamekeeper's drain: the
row stays for manual cleanup and admins are told once.
