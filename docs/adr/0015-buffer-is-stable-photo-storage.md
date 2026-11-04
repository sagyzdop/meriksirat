# The buffer is the stable home for album photos

New album photos are uploaded to the buffer, the club-run Google account defined
in [GLOSSARY.md](../../GLOSSARY.md#save-nu-image-savenuimg), and not to
flamekeepers. The buffer's 5 TB plan covers the roughly 640 GB expected at
two-year expiry with room to spare. Photos no longer depend on any student's
account, so no flamekeeper leaving, graduating or losing access puts photos at
risk or starts a deadline. Flamekeepers become optional reserve capacity. They
hold a photo only when an admin offloads it, which is never automatic.

The buffer is a system account, not a flamekeeper, and never holds a flamekeeper
grant. It has two tokens: a `drive.file` token for uploads, and a full-scope
token that the server alone uses for drains (see
[ADR-0016](0016-drains-run-on-server-with-buffer-full-token.md)). A volume's
folder is shared with the buffer only when the buffer first receives files in
it, as in [ADR-0008](0008-one-club-folder-per-album-photos-owned-by-flamekeepers.md).

When the buffer is full, uploads stop until space is freed. There is no
automatic fallback to flamekeepers, because that would put new uploads on
accounts the club does not control. Admins are warned at 90%. The cost is that
the buffer is a single point of failure: it depends on the paid plan
continuing. A cut to 2 TB still fits the estimate. A drop to the free 15 GB
would force an offload, which is why offload stays planned.

Not built yet. Stage 1 of [#15](https://github.com/sagyzdop/meriksirat/issues/15)
makes uploads land on the buffer. Offload is Stage 2 and waits for its live
tests. Until Stage 1 ships, [ADR-0008](0008-one-club-folder-per-album-photos-owned-by-flamekeepers.md)
still describes the running code.
