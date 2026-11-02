# Scenarios

What the app does, end to end. Each file has one data diagram (ERD) and sequence diagrams that follow a click, Telegram tap or cron run through to what the person sees at the end.

| File | Covers |
|---|---|
| [01](01-sign-in-onboarding-and-profile.md) | Sign-in, onboarding, Drive grant step, profile |
| [02](02-equipment-and-favorites.md) | Catalog, admin equipment and categories, images, favorites |
| [03](03-bookings.md) | Bookings on the website, for members and admins |
| [04](04-telegram-bot.md) | Bot commands, pickup and return, club channel log |
| [05](05-admin-console.md) | Dashboard, users, bans, birthdays, settings, exports |
| [06](06-albums-and-uploads.md) | Browsing, uploads, deleting, recreating folders and albums |
| [07](07-flamekeepers.md) | Joining, tokens, stepping down, moving photos, admin pool |
| [08](08-cron-overview-and-bookings.md) | The 5-minute cron in order, booking timers and reminders |
| [09](09-cron-flamekeepers.md) | Cron: health, pool, drain, bans, graduation |
| [10](10-cron-albums-and-housekeeping.md) | Cron: album expiry, notices, backfill, bot setup, signup cleanup |

When you change behaviour, change its diagram in the same commit.
