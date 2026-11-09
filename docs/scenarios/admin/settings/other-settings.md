# Other settings

Settings is one `global` row edited across five tabs: Bookings, Albums, Members, Flamekeepers, Storage. `/admin/settings` opens Members. Admins and managers can save every field except the ones marked admin only.

## Which settings exist and who reads them?

```mermaid
flowchart TD
    S["Settings save (updateSettingsFn, partial update)"] --> BK["Bookings: global booking note, operating hours start and end"]
    S --> AL["Albums: scheduled deletion period, default 14 days"]
    S --> ME["Members: birthdays calendar ID"]
    S --> FK["Flamekeepers: lost grace days, graduation prompt days"]
    S --> ST["Storage: buffer limit and alert, pool-low alert, per-account cap (admin only)"]
    BK --> R1["Time pickers on equipment pages; the note goes into the booking Telegram message"]
    AL --> R2["Album scheduling: deletion date = now + period"]
    ME --> R3["Birthday calendar sync"]
    FK --> R4["Stored only, see below"]
    ST --> R5["storage.md"]
```

- Operating hours start must be before end (minutes from midnight, 0-1439).
- The scheduled deletion period applies when an admin schedules an album for deletion from Album Management ([GLOSSARY](../../../../GLOSSARY.md), Scheduled deletion).
- Lost grace days (default 7) and Graduation prompt lead (default 60) are read by the lost-grace cron step, the reconnect email and the graduation stop ([account card](../../flamekeeper/account/account-card.md), [graduation](../../flamekeeper/account/graduation.md)).
- Club code, broadcast, test email and storage have their own files: [club-code.md](club-code.md), [broadcast.md](broadcast.md), [test-email.md](test-email.md), [storage.md](storage.md).
