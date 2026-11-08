# The buffer account is a stored, encrypted grant, switched by copying

The buffer's refresh token lives in D1 (`buffer_grant`), encrypted with the
`BUFFER_ENCRYPTION_KEY` secret, because a Worker cannot change its own secrets
and the buffer has to be changeable from the app. One full-`drive` token replaces
the old `drive.file` and full-scope pair: the full scope covers uploads too, and
one grant has one thing to lose.

Each buffer volume records the grant that holds it (`volume.buffer_grant_id`).
Switching accounts connects the new one as `pending`, copies every album's
volumes to it from the hourly cron (or "Copy more now"), and flips it `active`
only when nothing is left. Uploads use the old account until then. Cancel drops
the staged copies, so no album is lost. The old account is kept `retiring` for 7
days and its originals are removed with its own token after that. The env tokens
stay as a fallback while no grant is stored.

Loss never switches or deletes anything on its own. The grant records
`auth_failed`, `quota_full` or `missing`; uploads pause, admins get a dashboard
alert and one Telegram message, and reconnecting restores service.

The buffer email is reserved: it cannot sign up and cannot become a flamekeeper.
Volume folders are named `V<number><id>` (for example `V01Ab3dE9`), numbered per
album, so a downloaded album sorts in volume order.
