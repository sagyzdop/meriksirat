# Volumes hold at most 256 MB; a holder can have several per album

A volume holds at most 256 MB (`VOLUME_MAX_BYTES`, `src/lib/albums/volume-limit.ts`).
An upload, move or offload that would exceed it opens another volume, so one
holder (the buffer or a flamekeeper) can have several volumes for the same album.
This supersedes the one-volume-per-holder-per-album rule in ADR-0008 and
ADR-0017 (the buffer's partial unique index is gone). An album's storage holder
is the buffer or flamekeepers, never both.
