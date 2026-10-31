# Albums live in volumes on flamekeepers' Drives

The university capped every account at 20GB, so the club's master Google account
can no longer hold album photos. Each album keeps a root folder in the master
account, but that folder only holds Drive shortcuts ("Part 1", "Part 2", …) to
one or more volumes: folders in opted-in flamekeepers' own Drives, uploaded with
the flamekeeper's token so the bytes count against their quota. Folders and
shortcuts cost no quota, so the master account stays a stable, browsable index
and existing album links keep working. A new volume opens on the flamekeeper with
the most free space whenever an upload no longer fits the current one, because an
album's size is unknown when it is created and grows afterwards. Amends ADR-0005:
the "anyone" reader permission now goes on each volume as well as the root.

The master account must be back under its cap before it can create root folders
or shortcuts: Google lets an over-limit account view and download but not create.
