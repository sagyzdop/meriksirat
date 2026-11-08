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
- **Equipment**: Add, edit, and bulk edit equipment, with categories and clearance levels
- **Club Members**: Control member access, roles, status (Active, Inactive, Alumni) and clearance levels, with birthdays and violations
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
[the scenario](docs/scenarios/kv/buffer-usage.md)).

The buffer is a Google account an admin connects in Admin > Settings > Storage.
It uses the same OAuth client as production, one token with the full `drive`
scope. The app stores that token encrypted in D1 (`buffer_grant`); the browser
never receives it ([ADR-0021](docs/adr/0021-buffer-account-is-a-stored-grant.md)).

| Env or secret | Used for |
|---|---|
| `BUFFER_ENCRYPTION_KEY` | Required. Worker secret that encrypts the stored token. Losing it means reconnecting the account. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The shared OAuth client. |
| `GOOGLE_BUFFER_REFRESH_TOKEN`, `GOOGLE_BUFFER_FULL_REFRESH_TOKEN`, `GOOGLE_BUFFER_EMAIL` | Fallback only, used while no account is connected in the app. Once the account is connected they can be removed. |

Setup:

1. In Google Cloud Console, check that the OAuth consent screen allows the buffer
   account (user type External; in Testing mode, add it as a test user) and that
   `<your origin>/api/buffer/callback` is an authorized redirect URI on the
   OAuth client (for example `http://localhost:3000/api/buffer/callback`).
2. Set `BUFFER_ENCRYPTION_KEY` (`openssl rand -base64 32`) in `.env`, and in
   production with `wrangler secret put BUFFER_ENCRYPTION_KEY`.
3. Sign in as an admin, open Settings > Storage and press Connect. Pick the
   buffer account and allow full Drive access. Connecting the account the env
   tokens already point at adopts the existing albums with no copying.
4. To change the buffer, connect a different account. Albums are copied to it in
   the background (hourly, or "Copy more now"); uploads keep using the old
   account until every album is copied, then the new one takes over. Cancel
   discards the copies and changes nothing. The old account's originals are
   removed 7 days after the switch.

If the buffer loses access (revoked, password reset), uploads pause, admins get
an alert and a Telegram message, and reconnecting the same account restores
everything. Nothing switches or deletes on its own.

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
