# MerikSirat

A modern, full-stack equipment booking and management platform (and more) built for clubs
and organizations.

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

`.env.example` is the canonical key list — copy it (see Installation above) and fill in values. Production builds read bindings from `wrangler.jsonc`; secrets are set via `wrangler secrets`.

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

The annotated `src/` directory layout and domain library conventions live in
[Architecture](docs/dev/architecture.md).

## Key Workflows

Booking, pickup, returns, and extensions end to end:
[Booking Flow](docs/user/booking.md). Bot usage:
[Telegram Bot](docs/user/telegram-bot.md). Exact notification message formats:
[Telegram Logs](docs/dev/logs.md).

## Documentation

Detailed documentation lives in `docs/`:

### User-facing

- [FAQ](https://github.com/sagyzdop/meriksirat/blob/main/docs/faq.md) — common questions (linked from sidebar)
- [Terms of Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md) — user agreement (linked from sidebar + onboarding)

### Developer docs (`docs/dev/`)

- [Architecture](docs/dev/architecture.md) — stack overview and directory layout
- [Conventions](docs/dev/conventions.md) — route/component patterns, code style
- [Data Loading](docs/dev/data-loading.md) — TanStack Query + SSR integration
- [Workers KV](docs/dev/kv-architecture.md) — KV namespaces and caching layers
- [Albums](docs/dev/albums.md) — Drive-backed photo galleries and upload system
- [Calendar Viewer](docs/dev/calendar-viewer.md) — custom calendar replacing iframe embeds
- [Availability Badges](docs/dev/availability-badges.md) — Google Calendar free/busy batching
- [Worker Import Convention](docs/dev/worker-import-convention.md) — server-only import rules
- [Telegram Logs](docs/dev/logs.md) — inventory of all Telegram message formats

### User docs (`docs/user/`)

- [Booking Flow](docs/user/booking.md) — full booking lifecycle
- [Booking Internals](docs/dev/booking-internals.md) — data model, status derivation, cron mechanics
- [Telegram Bot](docs/user/telegram-bot.md) — bot usage guide
- [Member Guide](docs/user/member-guide.md) — how to use the platform
- [Admin Guide](docs/user/admin-guide.md) — administrative operations

## Contributing

This is a private project for club use. For feature requests or bug reports,
contact the administrators.

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE) for details.
