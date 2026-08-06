/**
 * One-off cleanup script for the booking model remodel.
 *
 * Before the `booking` table migration is applied, this script:
 *   1. Reads every prod booking that has a Google Calendar event
 *      (via `wrangler d1 execute --remote`).
 *   2. Deletes those events from Google Calendar.
 *   3. Clears the `booking` table (all rows).
 *
 * Usage:
 *   node scripts/cleanup-gcal.mjs            # delete events + clear booking table
 *   node scripts/cleanup-gcal.mjs --dry-run  # list events without deleting
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(rootDir, '.env')

const dryRun = process.argv.includes('--dry-run')
const DB_NAME = process.env.DB_NAME || 'meriksirat_d1'

// ---- Load .env manually (no dotenv dependency) ----
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2]
    }
  }
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_MASTER_REFRESH_TOKEN = process.env.GOOGLE_MASTER_REFRESH_TOKEN

for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_MASTER_REFRESH_TOKEN']) {
  if (!process.env[key]) throw new Error(`${key} is not set in .env`)
}

// ---- Helpers ----

async function getGoogleAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_MASTER_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    throw new Error(`Failed to refresh Google access token: ${await response.text()}`)
  }
  const data = await response.json()
  return data.access_token
}

async function deleteCalendarEvent(accessToken, calendarId, eventId) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  return response.ok
}

function runWrangler(command, extraArgs = []) {
  const args = ['d1', 'execute', DB_NAME, '--remote', ...command, ...extraArgs]
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// ---- Step 1: read bookings with calendar events ----
console.log('Reading prod bookings with calendar events...')
const query = [
  '--command',
  `SELECT b.id, b.gcal_event_id, e.gcal_id AS calendar_id
   FROM booking b
   JOIN equipment e ON e.id = b.equipment_id
   WHERE b.gcal_event_id IS NOT NULL`,
  '--json',
]
const raw = runWrangler(query)
const parsed = JSON.parse(raw)
const rows = Array.isArray(parsed)
  ? parsed.flatMap((entry) => entry.results ?? [])
  : parsed.results ?? []

console.log(`Found ${rows.length} booking(s) with calendar events.`)

if (dryRun) {
  for (const row of rows) {
    console.log(`  [dry-run] would delete event ${row.gcal_event_id} from calendar ${row.calendar_id} (booking #${row.id})`)
  }
  console.log('Dry run complete. Nothing was changed.')
  process.exit(0)
}

if (rows.length > 0) {
  const accessToken = await getGoogleAccessToken()
  let deleted = 0
  let failed = 0

  for (const row of rows) {
    try {
      const ok = await deleteCalendarEvent(accessToken, row.calendar_id, row.gcal_event_id)
      if (ok) {
        deleted++
        console.log(`  deleted event ${row.gcal_event_id} (booking #${row.id})`)
      } else {
        failed++
        console.error(`  FAILED to delete event ${row.gcal_event_id} (booking #${row.id})`)
      }
    } catch (error) {
      failed++
      console.error(`  ERROR deleting event ${row.gcal_event_id}: ${error.message}`)
    }
  }

  console.log(`Calendar cleanup finished: ${deleted} deleted, ${failed} failed.`)
}

// ---- Step 2: clear the booking table ----
const total = await new Promise((resolve) => {
  const out = runWrangler(['--command', 'SELECT count(*) AS total FROM booking', '--json'])
  const parsedOut = JSON.parse(out)
  const results = Array.isArray(parsedOut) ? parsedOut.flatMap((e) => e.results ?? []) : parsedOut.results ?? []
  resolve(Number(results[0]?.total ?? 0))
})

runWrangler(['--command', 'DELETE FROM booking'])

console.log(`Cleared booking table (${total} rows). Done.`)
