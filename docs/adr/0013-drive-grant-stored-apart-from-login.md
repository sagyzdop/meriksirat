# The flamekeeper Drive grant is stored apart from the login account

> **Amended by [ADR-0016](0016-drains-run-on-server-with-buffer-full-token.md).**
> The flamekeeper grant rules still hold: `drive.file` only, stored apart from
> login, and never on the master. Changes: the buffer's full-scope token is a
> separate server-side credential, not a flamekeeper grant. The daily health check
> becomes hourly, as `checkFlamekeeperHealth` in the hourly cron. Flamekeeper
> grants are used by offload, to mint upload addresses into their volumes and to
> list and delete what they hold. The text below is the original
> decision, kept for history.

The flamekeeper's offline `drive.file` refresh token lives in its own table,
written only by the "Connect Drive" consent flow (`access_type=offline`,
`prompt=consent`), never in better-auth's `account` row. Ordinary logins rewrite
that row and could silently drop the refresh token, killing the grant. A daily
health check exchanges each grant for an access token, which keeps it inside
Google's 6-month idle limit and spots revocation early. A failed refresh marks
the flamekeeper lost: they get one email to reconnect within 7 days. After that
their photos drop out of the app, and an album left with no photos becomes a
tombstone (ADR-0012). The files themselves stay in Drive, because the app can no
longer touch them (ADR-0008).

The club's master Google account (`GOOGLE_MASTER_EMAIL`) owns every album folder and shares its OAuth client with flamekeepers, so it can never be a flamekeeper: revoking that grant would also kill the master refresh token and stop album creation, listing and deletion site-wide, and the master is never selected to hold photos.
