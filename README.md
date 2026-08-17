# Meriksirat - Equipment Booking Management System

A modern, full-stack equipment booking and management platform built for clubs
and organizations. Meriksirat streamlines equipment reservations with real-time
availability tracking, Google Calendar integration, and Telegram bot
notifications.

## Features

### For Members

- **Equipment Catalog**: Browse available equipment with real-time availability status
- **Smart Booking System**: Book equipment with time slot selection and conflict detection
- **Google Calendar Integration**: View equipment availability directly from Google Calendar
- **Telegram Bot**: Receive notifications, check status, and manage bookings via Telegram
- **Pickup Confirmation**: 30-minute window to confirm equipment pickup
- **Partial Returns**: Return some items while keeping others with automatic grace periods
- **Photo Albums**: Upload and browse club photo galleries backed by Google Drive
- **Booking History**: Track all your past and current bookings

### For Administrators

- **Dashboard**: Overview of bookings, equipment usage, and system statistics
- **Equipment Management**: Add, edit, and manage equipment with categories and clearance levels
- **User Management**: Control user access, roles, and clearance levels
- **Booking Oversight**: Monitor all bookings, handle overdue equipment, and manage conflicts
- **Album Management**: Oversee public and member albums
- **Settings**: Configure operating hours, booking limits, and global notifications

### Technical Features

- **Clearance Levels**: Restrict high-end equipment to authorized users
- **Overdue Tracking**: Automatic alerts for late returns
- **Photo Verification**: Timestamped photos required for equipment returns
- **Multi-item Bookings**: Book multiple pieces of equipment with independent time slots
- **Booking Extensions**: Extend bookings by 30 minutes if no conflicts exist

## Tech Stack

- **Frontend**: React 19, TanStack Start, TanStack Router, TanStack Query
- **UI**: Tailwind CSS v4, shadcn/ui, Radix UI
- **Backend**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite), Drizzle ORM
- **Storage**: Cloudflare R2 (object storage), Cloudflare KV (caching)
- **Authentication**: Better Auth with Google OAuth
- **Calendar**: Google Calendar API (OAuth refresh tokens)
- **Notifications**: Telegram Bot API
- **Build**: Vite
- **Deployment**: Cloudflare Workers

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Google Cloud project with Calendar API enabled
- Telegram Bot Token

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Generate database migrations
npm run db:generate

# Apply migrations locally
npm run db:migrate-local

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Environment Variables

Create a `.env` file with the following:

```env
# Better Auth
BETTER_AUTH_SECRET=your_secret_key
BETTER_AUTH_URL=http://localhost:3000

# Cloudflare (for local dev — production uses wrangler bindings)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=

# Google OAuth (Calendar + Drive)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_MASTER_ACCESS_TOKEN=your_access_token
GOOGLE_MASTER_REFRESH_TOKEN=your_refresh_token

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CLUB_CHANNEL_ID=your_channel_id
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_RETURN_ENABLED=true

# Development mode (auto-skips Telegram onboarding step)
DEV=true
```

## Development

```bash
# Start development server (with Wrangler)
npm run dev

# Start Vite dev server only
npm run dev:vite

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

## Database Management

```bash
# Promote your local user to admin for testing admin-only flows.
npx wrangler d1 execute meriksirat_d1 --local --command "update user set role='admin' where email='you@example.com';"
```

```bash
# Generate new migration
npm run db:generate

# Apply migrations locally
npm run db:migrate-local

# Apply migrations to production
npm run db:migrate-remote
```

## Deployment

```bash
# Build and deploy to Cloudflare Workers
npm run deploy
```

### Cloudflare Resources

The app uses the following Cloudflare resources:

- **D1 Database**: `meriksirat_d1` — stores all application data
- **R2 Bucket**: `meriksirat` — stores equipment images and return photos
- **KV Namespace**: `meriksirat_kv` — caches album listing data
- **Cron Triggers**: Runs every 5 minutes to check booking statuses

## Project Structure

```
src/
├── routes/                  # File-based router (TanStack). Thin page constructors.
│   ├── _public/             # Public routes (login, signup)
│   └── _authenticated/      # Authed area: equipment, bookings, albums, admin/*
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── shared/              # Cross-page components (faceted filter, dialogs, calendar)
│   ├── layout/              # PageContainer, PageHeader, sidebar shell
│   ├── root/                # SiteHeader, authenticated shell
│   ├── admin/               # Admin pages (mirror routes)
│   ├── albums/              # Album pages
│   ├── bookings/            # Booking pages
│   ├── equipment/           # Equipment pages
│   ├── faq/                 # FAQ page
│   ├── onboarding/          # Onboarding flow
│   └── profile/             # User profile
├── lib/
│   ├── admin/               # Admin server functions + queries
│   ├── albums/              # Album server functions + upload manager
│   ├── auth/                # Better Auth setup + onboarding
│   ├── booking/             # Server functions, queries, types
│   ├── equipment/           # Server functions, queries, types
│   ├── user/                # User admin queries
│   ├── google/              # Google Calendar + Drive integration
│   ├── telegram/            # Telegram bot commands + logging
│   ├── search-params.ts     # URL array-param zod helpers
│   └── query-client.ts      # SSR-aware QueryClient factory
├── db/                      # Database schema and migrations
└── router.tsx               # Router + SSR query integration
```

## Key Workflows

### Booking Equipment

1. Browse equipment catalog
2. Select equipment and view calendar availability
3. Choose date and time slots (30-minute increments)
4. Confirm booking with optional notes
5. Receive Telegram notification
6. Confirm pickup within 15 minutes of start time

### Returning Equipment

1. Open Telegram bot
2. Select "End Booking" from the menu
3. Choose the booking and items to return
4. Send a photo of the equipment
5. Photo and return logged to the club channel

## Telegram Bot

The bot is menu-driven (inline keyboard, no slash commands):

- **My Bookings** — view active and upcoming bookings with item statuses
- **Start Booking** — confirm pickup for bookings in the start window
- **End Booking** — return equipment by selecting items and sending a photo
- **Cancel Booking** — cancel bookings that haven't been picked up yet

Reminders, overdue alerts, and admin notifications are sent as separate
messages. See `docs/dev/logs.md` for the full list of message formats.

## Documentation

Detailed documentation lives in `docs/`:

### Developer docs (`docs/dev/`)

- [Architecture](docs/dev/architecture.md) — stack overview and directory layout
- [Conventions](docs/dev/conventions.md) — route/component patterns, code style
- [Data Loading](docs/dev/data-loading.md) — TanStack Query + SSR integration
- [Albums](docs/dev/albums.md) — Drive-backed photo galleries and upload system
- [Calendar Viewer](docs/dev/calendar-viewer.md) — custom calendar replacing iframe embeds
- [Availability Badges](docs/dev/availability-badges.md) — Google Calendar free/busy batching
- [Worker Import Convention](docs/dev/worker-import-convention.md) — server-only import rules
- [Telegram Logs](docs/dev/logs.md) — inventory of all Telegram message formats
- [shadcn Reference](docs/dev/shadcn-reference.md) — component index
- [Starter Prompt](docs/dev/starter-prompt.md) — AI session bootstrap

### User docs (`docs/user/`)

- [Booking Flow](docs/user/booking.md) — full booking lifecycle
- [Member Guide](docs/user/member-guide.md) — how to use the platform
- [Admin Guide](docs/user/admin-guide.md) — administrative operations

### Legal

- [Terms of Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md) — user agreement and data policy

## Contributing

This is a private project for club use. For feature requests or bug reports,
contact the administrators.

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE) for details.
