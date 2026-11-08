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

Built in [#17](https://github.com/sagyzdop/meriksirat/issues/17): uploads land on
the buffer, in a `volume` row (no flamekeeper) per album whose folder is created by the
master and shared with the buffer on the first upload. The buffer's `drive.file`
token mints each resumable upload address, so the browser receives an address and
never a token. The full-scope token is read only by `src/lib/buffer/full-token.ts`,
which nothing imports yet. If the buffer is not configured or its token fails, the
upload fails with a plain message and nothing is placed on a flamekeeper.

Built in [#26](https://github.com/sagyzdop/meriksirat/issues/26): usage is read
from the Drive quota with the `drive.file` token and cached in KV. The hourly
step warns admins once per crossing of 90% and of 100%, tracked by a KV marker
that clears when usage falls below 90%, so the schema is untouched. The
banner and the dashboard card read the cache. Uploads are refused at 100% before
the browser sends any bytes. See
[the scenario](../scenarios/kv/buffer-usage.md).

Not built yet: offload (Stage 2, which waits for its live tests). Photos uploaded to flamekeepers before #17 stay
there until a drain. [ADR-0008](0008-one-club-folder-per-album-photos-owned-by-flamekeepers.md)
still describes them.
