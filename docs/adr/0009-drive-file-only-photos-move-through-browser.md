# Flamekeepers grant only drive.file; photos move through the browser

> **Amended by #24.** The relay, drain and placement code described below was
> removed because nobody holds photos on a flamekeeper until Stage 2. The last
> `dev` commit containing it is `2565826`; Stage 2 tickets restore what they need
> from the commit history.

> **Amended by [ADR-0016](0016-drains-run-on-server-with-buffer-full-token.md).**
> The `drive.file`-only rule for flamekeepers and the master still holds. Drains
> no longer go through the browser: the server copies photos to the buffer with
> the buffer's full-scope token. The browser relay stays only for an admin-started
> offload from the buffer to a flamekeeper (Stage 2, not built). The rule that
> photos are deleted when no browser relays them is removed. The 14-day deletion
> now applies only when a flamekeeper's own access blocks the drain
> ([ADR-0012](0012-no-backup-albums-expire.md)). The text below is the original
> decision, kept for history.

Flamekeepers grant the non-sensitive `drive.file` scope and nothing broader. The
full `drive` scope is restricted, which means a restricted-scope review and a
paid CASA security assessment every year, a cost a student club can't carry.
Under `drive.file` the server can't copy a photo between accounts, and the spike
showed that an ownership transfer leaves the file invisible to the new owner's
token. Moving a photo is therefore a browser relay: the browser downloads it
with the source flamekeeper's short-lived access token and uploads it straight
into the album folder through a resumable session minted for the destination
flamekeeper. The photo gets a new Drive file ID. No photo bytes ever pass
through the Worker, because the free Workers plan can't carry that traffic. If
no browser runs the relay before the deadline, the photos are deleted.
