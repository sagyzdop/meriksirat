# Meriksirat - Equipment Booking Management System

A modern, full-stack equipment booking and management platform built for clubs and organizations. Meriksirat streamlines equipment reservations with real-time availability tracking, Google Calendar integration, and Telegram bot notifications.

## Features

### For Members
- **Equipment Catalog**: Browse available equipment with real-time availability status
- **Smart Booking System**: Book equipment with time slot selection and conflict detection
- **Google Calendar Integration**: View equipment availability directly from Google Calendar
- **Telegram Bot**: Receive notifications, check status, and manage bookings via Telegram
- **Pickup Confirmation**: 30-minute window to confirm equipment pickup
- **Direct Handover**: Transfer equipment directly to the next user without returning to locker
- **Partial Returns**: Return some items while keeping others with automatic grace periods
- **Booking History**: Track all your past and current bookings

### For Administrators
- **Dashboard**: Overview of bookings, equipment usage, and system statistics
- **Equipment Management**: Add, edit, and manage equipment with categories and clearance levels
- **User Management**: Control user access, roles, and clearance levels
- **Booking Oversight**: Monitor all bookings, handle overdue equipment, and manage conflicts
- **Settings**: Configure operating hours, booking limits, and global notifications

### Technical Features
- **Clearance Levels**: Restrict high-end equipment to authorized users
- **Overdue Tracking**: Automatic alerts for late returns
- **Photo Verification**: Timestamped photos required for equipment returns
- **Multi-item Bookings**: Book multiple pieces of equipment with independent time slots
- **Booking Extensions**: Extend bookings by 30 minutes if no conflicts exist

## Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Query
- **UI**: Tailwind CSS 4, shadcn/ui, Radix UI
- **Backend**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite), Drizzle ORM
- **Storage**: Cloudflare R2 (object storage for images)
- **Cache**: Cloudflare KV
- **Authentication**: Better Auth with Google OAuth
- **Calendar**: Google Calendar API
- **Notifications**: Telegram Bot API
- **Build Tool**: Vite
- **Deployment**: Cloudflare Workers

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Google Cloud project with Calendar API enabled
- Telegram Bot Token
- Service account credentials for Google Calendar

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
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Google Calendar Service Account
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Better Auth
BETTER_AUTH_SECRET=your_secret_key
BETTER_AUTH_URL=http://localhost:3000
```

## Development

```bash
# Start development server with Wrangler
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
npx wrangler d1 execute meriksirat --local --command "update user set role='admin' where email='you@example.com';"
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
- **D1 Database**: `meriksirat` - stores all application data
- **R2 Bucket**: `meriksirat` - stores equipment images and return photos
- **KV Namespace**: `meriksirat_kv` - caches session data and Telegram state
- **Cron Triggers**: Runs every 5 minutes to check booking statuses

## Project Structure

```
src/
├── components/          # React components
│   ├── admin/          # Admin dashboard components
│   ├── bookings/       # Booking management
│   ├── equipment/      # Equipment catalog
│   ├── profile/        # User profile
│   ├── ui/             # shadcn/ui components
│   └── shared/         # Shared components
├── db/                 # Database schema and config
├── lib/                # Business logic
│   ├── auth/          # Authentication
│   ├── booking/       # Booking functions
│   ├── equipment/     # Equipment functions
│   ├── telegram/      # Telegram bot
│   └── google/        # Google Calendar integration
├── routes/            # TanStack Router routes
└── styles.css         # Global styles

migrations/            # Database migrations
public/               # Static assets
```

## Key Workflows

### Booking Equipment
1. Browse equipment catalog
2. Select equipment and view calendar
3. Choose date and time slots
4. Confirm booking with optional notes
5. Receive Telegram notification
6. Confirm pickup within 30 minutes of start time

### Returning Equipment
1. Go to active bookings
2. Click "End Booking"
3. Upload photo of equipment
4. Confirm return
5. Photo sent to admins for verification

### Equipment Handover
1. Initiate handover from active booking
2. Next user receives notification
3. Both users confirm handover
4. Complete equipment condition checklist

## Telegram Bot Commands

- `/start` - Link your Telegram account
- `/status` - Check equipment availability
- `/mybookings` - View your active bookings
- `/handover` - Transfer equipment to another user
- `/end_booking` - Return equipment

## Contributing

This is a private project for club use. For feature requests or bug reports, contact the administrators.

## License

Private - All rights reserved
