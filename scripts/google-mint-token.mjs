/**
 * Re-run the master-account OAuth flow to mint a NEW refresh token.
 *
 * Use this when you need to grant additional scopes (e.g. drive.file for
 * photo albums) to the existing GOOGLE_MASTER_REFRESH_TOKEN. Scopes are
 * fixed when a token is issued, so a fresh consent + token is required.
 *
 * Usage:
 *   node scripts/google-mint-token.mjs
 *   node scripts/google-mint-token.mjs --port 9000
 *   node scripts/google-mint-token.mjs --redirect-uri http://localhost:9000/oauth
 *
 * The redirect URI used here MUST be registered on the OAuth client in
 * Google Cloud Console (APIs & Services -> Credentials -> your OAuth client
 * -> Authorized redirect URIs). If the browser shows a "redirect_uri
 * mismatch" error, add it there and re-run.
 *
 * It starts a tiny local server, opens your browser at the Google consent
 * screen, exchanges the returned code for a refresh token, and prints it
 * together with the granted scopes. Copy the token into .env as
 * GOOGLE_MASTER_REFRESH_TOKEN and restart the dev server.
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(rootDir, '.env')

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

for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
  if (!process.env[key]) throw new Error(`${key} is not set in .env`)
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
]

const argPort = process.argv.indexOf('--port')
const argRedirect = process.argv.indexOf('--redirect-uri')

const PORT = argPort !== -1 ? Number(process.argv[argPort + 1]) : 8788
const REDIRECT_URI =
  argRedirect !== -1
    ? process.argv[argRedirect + 1]
    : `http://localhost:${PORT}/oauth`
const state = Math.random().toString(36).slice(2)

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

async function exchangeCode(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`)
  }
  return response.json()
}

async function checkScopes(accessToken) {
  const info = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  )
  const data = await info.json()
  if (data.error) throw new Error(`tokeninfo failed: ${JSON.stringify(data)}`)
  return data.scope.split(' ')
}

const server = createServer((req, res) => {
  const url = new URL(req.url, REDIRECT_URI)
  if (url.pathname !== '/oauth') {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  if (url.searchParams.get('state') !== state) {
    res.writeHead(400)
    res.end('state mismatch — abort')
    return
  }
  const code = url.searchParams.get('code')
  if (!code) {
    res.writeHead(400)
    res.end(`OAuth error: ${url.searchParams.get('error')}`)
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<h1>Done! You can close this tab.</h1>')
  exchangeCode(code)
    .then(async (tokens) => {
      const scopes = await checkScopes(tokens.access_token)
      console.log('\n=== NEW GOOGLE_MASTER_REFRESH_TOKEN ===')
      console.log(tokens.refresh_token)
      console.log('==========================================')
      console.log('Granted scopes:')
      for (const scope of scopes) console.log('  -', scope)
      console.log(
        '\nCopy the token above into .env as GOOGLE_MASTER_REFRESH_TOKEN,'
      )
      console.log('then restart the dev server.')
    })
    .catch((err) => console.error('\nERROR:', err.message))
    .finally(() => server.close())
})

server.listen(PORT, () => {
  console.log(`Listening on ${REDIRECT_URI}`)
  console.log(`Using OAuth client ...${GOOGLE_CLIENT_ID.slice(-8)} from .env`)
  console.log('Opening browser for Google consent...')
  console.log(
    `\nIMPORTANT: if you see a "redirect_uri mismatch" error, register this URI\n` +
      `  ${REDIRECT_URI}\n` +
      `under Google Cloud Console -> APIs & Services -> Credentials -> the OAuth\n` +
      `client whose Client ID ENDS WITH "...${GOOGLE_CLIENT_ID.slice(-8)}"\n` +
      `(NOT a different client/project), in "Authorized redirect URIs", then\n` +
      `re-run this script.\n`
  )
  spawn('open', [authUrl], { stdio: 'ignore' })
})
