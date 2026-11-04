# Flamekeepers must use @nu.edu.kz accounts

> **Amended by [ADR-0015](0015-buffer-is-stable-photo-storage.md).**
> The rule that flamekeepers must be `@nu.edu.kz` still holds, and so does the
> 20GB quota reason. The reason about ownership transfer no longer applies: copies
> between accounts are uploads made by a token that owns the new file
> ([ADR-0016](0016-drains-run-on-server-with-buffer-full-token.md)), not transfers.
> The text below is the original decision, kept for history.

Only `@nu.edu.kz` Google accounts can become flamekeepers. They have the usable
20GB, ownership transfer works only inside the same Workspace organization, and
staying inside one org keeps verification simple. Personal Gmail (15GB shared
with the person's own mail and photos) and `alumni.nu.edu.kz` (about 500MB) are
excluded. The rule stands even though NU may cut the per-account quota further.
Club membership itself stays open to any Google account, as it is today.

Membership is no longer open to any Google account; see ADR-0014.
