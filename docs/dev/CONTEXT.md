# docs/dev/ — factory reference for shipping changes

One job: the stable reference an agent or developer reads before changing code here.

## Inputs

- Reference (every run): `../../AGENTS.md` — commands and always-on rules.
- Reference (on demand): the code itself (`../../src/`, `../../server.ts`).

Do NOT load: the whole folder, `../user/`, or `../_archive/`. Pick the one file matching the task.

## Process

1. Read only the doc(s) for the subsystem being touched.
2. Facts live in exactly one file; link to it, never restate it.
3. Claims must match the code — if the code changed, fix the doc in the same change.

## Outputs

- Updated or new `.md` in this folder, registered in `README.md` → Documentation.

## Human check

Open every relative link in the touched docs — each resolves, and the README line exists.
