# docs/ — the knowledge layer

One job: hold every piece of documentation for this repo, split by audience, with one home per fact.

## Folder roles

- `dev/` — factory reference for agents and developers shipping changes (conventions, architecture, subsystem docs). Read on demand; never load the whole folder.
- `user/` — how-to guides for humans using the platform (booking, Telegram bot, member/admin operations).
- `faq.md`, `terms-of-service.md` — published docs, linked from the app.
- `_archive/` — superseded material. Nothing live may link here.

## Pinned files (do not move or rename)

- `faq.md` — hardcoded GitHub URL in `src/components/root/app-sidebar.tsx`.
- `terms-of-service.md` — hardcoded GitHub URLs in `src/components/root/app-sidebar.tsx` and `src/components/onboarding/components/tos-acceptance-dialog.tsx`.

Moving these breaks the deployed sidebar/onboarding links. See `dev/CONTEXT.md` before touching anything else in this tree.

## Adding or changing a doc

1. Put it in `dev/` (changes how we build) or `user/` (changes how it's used).
2. Register one line in `README.md` → Documentation (the canonical file inventory).
3. Link to the doc from its siblings instead of restating its content.

## Entry points

- Agents: `../AGENTS.md` (root).
- Humans on GitHub: `../README.md` → Documentation.
