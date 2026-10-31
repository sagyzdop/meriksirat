# One club folder per album; photos are owned by flamekeepers

The university capped every account at 20GB, so the club's master account can no
longer pay for album photos. Each album is still a single public folder in the
master account (ADR-0005 holds unchanged), but every photo in it is uploaded
with a flamekeeper's own `drive.file` token. A photo is owned by whoever uploads
it, even inside someone else's folder, so it counts against that flamekeeper's
quota while it inherits the folder's "anyone" reader permission and is served
from Google's CDN as before (verified by the #savenuimg spike). A **volume** is
therefore only a database grouping: the photos of one album held by one
flamekeeper. It is not a Drive folder.

Because `drive.file` lets each account see only the files it created, the master
token can't list or delete flamekeepers' photos. The app keeps a photo table
(stable photo ID, current Drive file ID, volume, bytes) written at upload, and
deletes each photo with its owner's token before deleting the folder. The photo
ID stays the same when a photo moves to a new Drive file, so favorites survive
the move. A lost flamekeeper's photos can't be deleted by the app and keep the
album folder from being deleted: they drop out of the app but stay public in
Drive until their owner removes them. The master account must stay able to
create folders, so it has to get back under its own cap.
