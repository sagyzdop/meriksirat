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

### Connecting the buffer account

New album photos upload to the buffer, the club-run Google account
`nuimage.storage@gmail.com` (see [GLOSSARY.md](GLOSSARY.md#save-nu-image-savenuimg)
and [ADR-0015](docs/adr/0015-buffer-is-stable-photo-storage.md)). Uploads fail
with "Photo storage is not available right now" until it is connected. Nothing
falls back to a flamekeeper. The Worker reads the account's Drive quota with the
`drive.file` token, warns admins at 90% and refuses uploads at 100% (see
[the scenario](docs/scenarios/cron/flamekeepers/buffer-usage.md)).

The buffer uses the same OAuth client as production and holds two tokens:

| Env or secret | Scope | Used for |
|---|---|---|
| `GOOGLE_BUFFER_REFRESH_TOKEN` | `drive.file` | Every upload. The Worker mints a resumable upload address with it; the browser never receives the token. |
| `GOOGLE_BUFFER_FULL_REFRESH_TOKEN` | full `drive` | Server-only drains from flamekeepers (Stage 2, [ADR-0016](docs/adr/0016-drains-run-on-server-with-buffer-full-token.md)). Nothing reads it yet. |
| `GOOGLE_BUFFER_EMAIL` | none | Optional, defaults to `nuimage.storage@gmail.com`. |

Setup:

1. In Google Cloud Console, check that the OAuth consent screen allows a
   `gmail.com` account (user type External; in Testing mode, add the buffer as a
   test user) and that `http://localhost:8788/oauth` is an authorized redirect
   URI on the OAuth client.
2. With `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`, run
   `node scripts/google-mint-token.mjs --account buffer-upload` and sign in as
   the buffer. Put the printed token in `.env` as `GOOGLE_BUFFER_REFRESH_TOKEN`.
   The script prints the account it got; stop if it is not the buffer.
3. Run `node scripts/google-mint-token.mjs --account buffer-full`, sign in as the
   buffer again, and keep the printed token as `GOOGLE_BUFFER_FULL_REFRESH_TOKEN`.
4. In production, set both with `wrangler secret put`. Never put either in a
   `vars` block or any `VITE_` variable.

Minting a token does not revoke the master account's grant. Never revoke the app
on the master account at myaccount.google.com/permissions: it shares the OAuth
client with production. The master account never gets the full `drive` scope.

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
- **Cron Triggers**: Three schedules (every 5 minutes, hourly, daily at 03:00 UTC), each with its own budget. See [docs/scenarios/cron/overview.md](docs/scenarios/cron/overview.md)

## Project Structure

The code lives in `src/`. Domain vocabulary is fixed in
[GLOSSARY.md](GLOSSARY.md); architectural decisions are recorded as
[ADRs](docs/adr/).

## Documentation

- [Glossary](GLOSSARY.md) — canonical domain vocabulary
- [ADRs](docs/adr/) — architectural decisions that are hard to reverse
- [Issue tracker](docs/agents/issue-tracker.md) — where issues live (GitHub)
- [Triage labels](docs/agents/triage-labels.md) — canonical triage roles → repo label strings
- [Domain docs](docs/agents/domain.md) — how skills read the glossary / ADRs
- [FAQ](https://github.com/sagyzdop/meriksirat/blob/main/docs/faq.md) — common questions (linked from the About page)
- [Terms of Service](https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md) — user agreement (linked from the About page + login page)

## Contributing

This is a private project for club use. For feature requests or bug reports,
contact the administrators.

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE) for details.
