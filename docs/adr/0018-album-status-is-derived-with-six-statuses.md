# Album status is derived, with six statuses

An album's status is computed on read from its deletion fields, rescue and
schedule dates and its live volumes (`src/lib/albums/status.ts`); it is never
stored. Precedence, first match wins: Lost, Deleted, Scheduled for deletion,
Rescued, Unhealthy, Healthy.

Lost and Deleted are both deleted albums; Lost is when the tombstone reason is a
lost or departed flamekeeper or a deleted Drive folder. Unhealthy is a live
(not dropped) volume on a flamekeeper that is lost or partially lost. Deriving
keeps the status from drifting from the volumes it describes.
