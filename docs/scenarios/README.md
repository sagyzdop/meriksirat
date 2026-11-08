# Scenarios

What the app does, from a click, Telegram tap or cron run through to what the person sees at the end. Each file answers a few questions with short diagrams. Folders follow who sees the feature, matching the sidebar and UI each role gets.

| Folder | Covers |
|---|---|
| [anon](anon/) | Signed-out visitors: public albums and the access gate |
| [member](member/) | Club members: [account](member/account/), [equipment](member/equipment/), [bookings](member/bookings/), [albums](member/albums/), [Telegram bot](member/telegram/) |
| [flamekeeper](flamekeeper/) | Connecting a Drive, pledge, stopping, graduation |
| [admin](admin/) | Dashboard, club members, equipment, bookings, albums, flamekeepers, settings |
| [cron](cron/) | The 5-minute, hourly and daily runs, starting at the [overview](cron/overview.md) |
| [erd](erd/) | Tables by domain |
| [kv](kv/) | KV keys and what they hold |

When you change behaviour, change its diagram in the same commit.
