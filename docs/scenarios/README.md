# Scenarios

What the app does, from a click, Telegram tap or cron run through to what the person sees at the end. Each file holds one diagram, with the question it answers above it. `erd.md` in each folder shows the tables that folder uses.

| Folder | Covers |
|---|---|
| [account](account/) | Sign-in, onboarding, profile, deleting an account, the About page |
| [equipment](equipment/) | Browsing equipment, availability, favorites, images |
| [bookings](bookings/) | Bookings on the website, for members and admins |
| [telegram](telegram/) | The bot and the club channel log |
| [admin](admin/) | Dashboard, members, bans, categories, equipment, birthdays |
| [albums](albums/) | Albums, uploads, deleting, folder warnings |
| [flamekeepers](flamekeepers/) | Connecting a Drive, stepping down, moving photos, the pool |
| [cron](cron/) | The 5-minute, hourly and daily runs: start at [overview](cron/overview.md), then bookings, flamekeepers, albums and housekeeping |

When you change behaviour, change its diagram in the same commit.
