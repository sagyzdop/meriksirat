/**
 * Spike: can a "buffer" Gmail account (nuimage.storage@gmail.com) absorb album
 * photos owned by flamekeepers, and can we list/delete them without per-owner
 * stored IDs? Plain Node fetch, no dependencies. Run by a human only.
 *
 * Roles (one browser consent each, login_hint + prompt=consent):
 *   MASTER  nu_image@nu.edu.kz (GOOGLE_MASTER_EMAIL), drive.file only
 *   A, B    two @nu.edu.kz accounts, drive.file only
 *   BUFFER  nuimage.storage@gmail.com, drive.file only
 *   BUFFER_FULL  (only with --buffer-full-scope, test T3b) BUFFER again, with the
 *           RESTRICTED full `drive` scope. MASTER never requests full `drive`.
 *
 * Prerequisites
 *   1. .env has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (same OAuth client as
 *      scripts/google-mint-token.mjs). Only the keys this script needs are read.
 *   2. Register the redirect URI on that OAuth client (Cloud Console ->
 *      APIs & Services -> Credentials -> client -> Authorized redirect URIs):
 *        http://localhost:8788/oauth        (or pass --redirect-uri)
 *   3. The OAuth consent screen must allow a gmail.com account: user type
 *      "External" (an "Internal" app rejects nuimage.storage@gmail.com). If
 *      the app is in Testing mode, add all four emails as test users.
 *   4. Optional, for T4a: enable the Drive API key. Cloud Console -> APIs &
 *      Services -> Library -> "Google Drive API" -> Enable; Credentials ->
 *      Create credentials -> API key (restrict it to the Drive API). Then
 *      export GOOGLE_DRIVE_API_KEY=... (or put it in .env). Without it T4a is
 *      skipped with a message.
 *   5. A and B emails: --a-email / --b-email, or SPIKE_A_EMAIL / SPIKE_B_EMAIL,
 *      or you are asked on first run (needed for login_hint).
 *
 * Flags
 *   --help                      print this usage and exit
 *   --dry-run                   print the plan (tests, roles, scopes), no network
 *   --only T1,T4                run only these tests (T1 T2 T3a T3b T4 T5 T6 T7 T7b)
 *   --buffer-full-scope         enable T3b (extra consent, full `drive`, BUFFER)
 *   --redirect-uri <uri>        default http://localhost:8788/oauth
 *   --a-email <e> --b-email <e> login hints for A and B
 *   --cleanup-only <file.json>  delete everything a previous run left behind
 *   --forget-tokens             delete the cached refresh tokens and exit
 *
 * Run
 *   node scripts/spike-buffer-drain.mjs --dry-run
 *   node scripts/spike-buffer-drain.mjs
 *   node scripts/spike-buffer-drain.mjs --only T1
 *   node scripts/spike-buffer-drain.mjs --buffer-full-scope --only T3a,T3b
 *   node scripts/spike-buffer-drain.mjs --cleanup-only <path printed at the end>
 *   node scripts/spike-buffer-drain.mjs --forget-tokens
 *
 * Refresh tokens are cached (mode 0600) in the OS temp dir, outside the repo,
 * at spike-buffer-tokens-<client suffix>.json. Delete it with --forget-tokens
 * when done, and revoke the app at myaccount.google.com/permissions.
 *
 * Every created name starts with `spike-buffer-`. Only IDs this script created
 * are ever deleted. Results JSON goes to the OS temp dir (path is printed).
 */
import { createServer } from 'node:http'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  chmodSync,
} from 'node:fs'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { tmpdir } from 'node:os'
import { deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const has = (flag) => argv.includes(flag)
const arg = (flag) => {
  const i = argv.indexOf(flag)
  return i === -1 ? undefined : argv[i + 1]
}

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_FULL = 'https://www.googleapis.com/auth/drive'
const BUFFER_EMAIL = 'nuimage.storage@gmail.com'
const ROLES = ['MASTER', 'A', 'B', 'BUFFER', 'BUFFER_FULL']
const TESTS = ['T1', 'T2', 'T3A', 'T3B', 'T4', 'T5', 'T6', 'T7', 'T7B']
const NEEDS = {
  T1: ['MASTER', 'A', 'B'],
  T2: ['A', 'BUFFER'],
  T3A: ['MASTER', 'A', 'BUFFER'],
  T3B: ['MASTER', 'A', 'BUFFER', 'BUFFER_FULL'],
  T4: ['MASTER', 'A'],
  T5: ['MASTER', 'A'],
  T6: ['MASTER', 'A', 'BUFFER'],
  T7: ['MASTER', 'A', 'B'],
  T7B: ['MASTER', 'A', 'B'],
}
const FILE_FIELDS =
  'files(id,name,size,md5Checksum,owners(emailAddress),mimeType)'

function scopesFor(role) {
  const scopes =
    role === 'BUFFER_FULL'
      ? ['openid', 'email', DRIVE_FULL]
      : ['openid', 'email', DRIVE_FILE]
  if (role === 'MASTER' && scopes.includes(DRIVE_FULL)) {
    throw new Error('MASTER must never request the full drive scope')
  }
  return scopes
}

function selectedTests() {
  const only = arg('--only')
  const fullFlag = has('--buffer-full-scope')
  let list = only
    ? only.toUpperCase().split(',').filter(Boolean)
    : TESTS.filter((t) => t !== 'T3B' || fullFlag)
  const bad = list.filter((t) => !TESTS.includes(t))
  if (bad.length) throw new Error(`Unknown test id(s): ${bad.join(', ')}`)
  if (list.includes('T3B') && !fullFlag) {
    console.log('T3b needs --buffer-full-scope; skipping T3b.')
    list = list.filter((t) => t !== 'T3B')
  }
  return list
}

if (has('--help') || has('-h')) {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  console.log(
    src
      .slice(src.indexOf('/**') + 4, src.indexOf(' */'))
      .replace(/^ \* ?/gm, '')
  )
  process.exit(0)
}

if (has('--dry-run')) {
  const tests = selectedTests()
  console.log('Dry run (no network, no credentials read).\n')
  console.log(`Tests: ${tests.join(', ') || '(none)'}`)
  const roles = new Set()
  for (const t of tests) for (const r of NEEDS[t]) roles.add(r)
  for (const r of ROLES.filter((r) => roles.has(r))) {
    console.log(`  consent ${r.padEnd(11)} scopes: ${scopesFor(r).join(' ')}`)
  }
  console.log(
    `\nRedirect URI: ${arg('--redirect-uri') ?? 'http://localhost:8788/oauth'}`
  )
  console.log(
    `Token cache : ${join(tmpdir(), 'spike-buffer-tokens-<client>.json')}`
  )
  console.log(
    `API key     : ${process.env.GOOGLE_DRIVE_API_KEY ? 'set in env' : 'not in env (.env checked at run time)'}`
  )
  process.exit(0)
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const WANTED = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_MASTER_EMAIL',
  'GOOGLE_DRIVE_API_KEY',
  'SPIKE_A_EMAIL',
  'SPIKE_B_EMAIL',
]
const envPath = join(rootDir, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (match && WANTED.includes(match[1]) && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
}
for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
  if (!process.env[key]) {
    console.error(`${key} is not set (.env or environment). Try --help.`)
    process.exit(1)
  }
}
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env
const API_KEY = process.env.GOOGLE_DRIVE_API_KEY || ''

const CACHE_PATH = join(
  tmpdir(),
  `spike-buffer-tokens-${GOOGLE_CLIENT_ID.slice(-8).replace(/\W/g, '')}.json`
)
if (has('--forget-tokens')) {
  if (existsSync(CACHE_PATH)) unlinkSync(CACHE_PATH)
  console.log(`Removed ${CACHE_PATH} (if it existed). Also revoke the app at`)
  console.log('https://myaccount.google.com/permissions for each account.')
  process.exit(0)
}

const REDIRECT_URI = arg('--redirect-uri') ?? 'http://localhost:8788/oauth'
const redirect = new URL(REDIRECT_URI)
const PORT = Number(redirect.port || 80)

const RUN_ID = Date.now().toString(36)
const NAME = (s) => `spike-buffer-${RUN_ID}-${s}`
const RESULTS_PATH = join(tmpdir(), `spike-buffer-results-${RUN_ID}.json`)

const results = []
const created = []
const leftovers = []
const emails = {}
const loaded = new Map()
const inflight = new Map()
const pending = new Map()
let server = null
let currentPath = RESULTS_PATH

// ---------- results ----------

function persist() {
  try {
    writeFileSync(
      currentPath,
      JSON.stringify(
        { runId: RUN_ID, accounts: emails, results, created, leftovers },
        null,
        2
      )
    )
  } catch {}
}

function push(test, check, ok, status, detail, expected) {
  results.push({ test, check, ok, status, detail, expected: expected ?? null })
  const label = ok === true ? 'PASS' : ok === false ? 'FAIL' : 'INFO'
  console.log(
    `${label}${expected ? ` (expected ${expected})` : ''}  ${test}  ${check}\n      ${status ? `[${status}] ` : ''}${detail}`
  )
  persist()
}

function describe(res) {
  if (res.ok) return `HTTP ${res.status}`
  const error = res.body?.error
  const reason = error?.errors?.[0]?.reason ?? error?.status ?? ''
  const msg = typeof error === 'string' ? error : error?.message
  return `HTTP ${res.status} ${reason} ${msg ?? ''}`.trim()
}

// API call outcome: PASS when the call succeeded.
function rec(test, check, res, extra = '', expected) {
  push(
    test,
    check,
    res.ok,
    res.status,
    [res.ok ? '' : describe(res), extra].filter(Boolean).join(' | ') || 'ok',
    expected
  )
}

// ---------- http ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(url, init, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      const response = await fetch(url, init)
      if ([429, 500, 502, 503].includes(response.status) && i < attempts) {
        await sleep(1000 * 2 ** i)
        continue
      }
      return response
    } catch (err) {
      if (i >= attempts) throw err
      console.log(
        `  (network error: ${err.cause?.code ?? err.message}; retry ${i}/${attempts - 1})`
      )
      await sleep(1000 * 2 ** i)
    }
  }
}

// role === null sends no Authorization header (API key / anonymous calls).
async function drive(role, url, init = {}) {
  const full = url.startsWith('http') ? url : `${API}${url}`
  const headers = { ...init.headers }
  if (role) headers.Authorization = `Bearer ${await getToken(role)}`
  const response = await fetchWithRetry(full, { ...init, headers })
  const buf = Buffer.from(await response.arrayBuffer())
  const type = response.headers.get('content-type') ?? ''
  let body
  if (type.includes('json') || (!type && buf.length)) {
    try {
      body = JSON.parse(buf.toString('utf8'))
    } catch {
      body = buf.toString('utf8')
    }
  } else {
    body = buf.length ? { bytes: buf.length, contentType: type } : null
  }
  return { ok: response.ok, status: response.status, body }
}

const json = (obj) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
})
const q = (parent) =>
  encodeURIComponent(`'${parent}' in parents and trashed = false`)

// ---------- oauth ----------

function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    return {}
  }
}
const cache = loadCache()
function saveCache() {
  writeFileSync(CACHE_PATH, JSON.stringify(cache), { mode: 0o600 })
  try {
    chmodSync(CACHE_PATH, 0o600)
  } catch {}
}

function hintFor(role) {
  if (role === 'MASTER')
    return process.env.GOOGLE_MASTER_EMAIL || 'nu_image@nu.edu.kz'
  if (role === 'BUFFER' || role === 'BUFFER_FULL') return BUFFER_EMAIL
  return undefined
}

async function askEmail(role) {
  const preset =
    role === 'A'
      ? (arg('--a-email') ?? process.env.SPIKE_A_EMAIL)
      : (arg('--b-email') ?? process.env.SPIKE_B_EMAIL)
  if (preset) return withNuDomain(preset)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`Email for account ${role} (@nu.edu.kz): `)
  rl.close()
  return withNuDomain(answer)
}

function withNuDomain(value) {
  const email = value.trim()
  return email.includes('@') ? email : `${email}@nu.edu.kz`
}

function ensureServer() {
  if (server) return Promise.resolve()
  server = createServer((req, res) => {
    const url = new URL(req.url, redirect.origin)
    if (url.pathname !== redirect.pathname) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    const state = url.searchParams.get('state')
    const entry = pending.get(state)
    const code = url.searchParams.get('code')
    if (!entry || !code) {
      res.writeHead(400)
      res.end(`OAuth error: ${url.searchParams.get('error') ?? 'bad state'}`)
      return
    }
    pending.delete(state)
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<h1>Signed in. You can close this tab.</h1>')
    entry.resolve(code)
  })
  return new Promise((resolve) => server.listen(PORT, resolve))
}

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url.replace(/&/g, '^&')]]
        : ['xdg-open', [url]]
  spawn(cmd[0], cmd[1], { stdio: 'ignore' }).on('error', () => {})
}

async function tokenRequest(params) {
  const response = await fetchWithRetry('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      ...params,
    }),
  })
  const body = await response.json().catch(() => ({}))
  return { ok: response.ok, body }
}

async function consent(role) {
  await ensureServer()
  const hint = cache[role]?.hint ?? hintFor(role) ?? (await askEmail(role))
  const scopes = scopesFor(role)
  const state = `${role}-${Math.random().toString(36).slice(2)}`
  const url =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      login_hint: hint,
      state,
    })
  console.log(`\n>>> Consent for ${role} as ${hint}`)
  console.log(`    scopes: ${scopes.join(' ')}`)
  if (role === 'BUFFER_FULL') {
    console.log('    !!! RESTRICTED full `drive` scope, opt-in test T3b only.')
  }
  console.log(`    If no browser opens, visit:\n    ${url}\n`)
  const code = await new Promise((resolve, reject) => {
    pending.set(state, { resolve })
    setTimeout(() => reject(new Error(`consent for ${role} timed out`)), 300000)
    openBrowser(url)
  })
  const tok = await tokenRequest({
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  })
  if (!tok.ok || !tok.body.refresh_token) {
    throw new Error(
      `token exchange failed for ${role}: ${JSON.stringify(tok.body)}`
    )
  }
  const granted = (tok.body.scope ?? '').split(' ')
  console.log(`    granted: ${granted.join(' ')}`)
  if (role !== 'BUFFER_FULL' && granted.includes(DRIVE_FULL)) {
    throw new Error(
      `${role} was granted full drive scope; refusing to continue`
    )
  }
  cache[role] = { refresh: tok.body.refresh_token, hint }
  saveCache()
  return tok.body
}

async function mint(role) {
  if (cache[role]?.refresh) {
    const r = await tokenRequest({
      refresh_token: cache[role].refresh,
      grant_type: 'refresh_token',
    })
    if (r.ok) return r.body
    console.log(`  (cached token for ${role} rejected; asking again)`)
    delete cache[role].refresh
  }
  return consent(role)
}

async function identify(role, access) {
  const r = await fetchWithRetry(
    'https://openidconnect.googleapis.com/v1/userinfo',
    { headers: { Authorization: `Bearer ${access}` } }
  )
  const email = (await r.json().catch(() => ({}))).email?.toLowerCase()
  if (!email) throw new Error(`could not read the email of ${role}`)
  const hint = cache[role]?.hint ?? hintFor(role)
  if (hint && hint.toLowerCase() !== email) {
    delete cache[role]
    saveCache()
    throw new Error(`${role}: signed in as ${email}, expected ${hint}`)
  }
  for (const [other, e] of Object.entries(emails)) {
    if (other === role) continue
    const same = role.startsWith('BUFFER') && other.startsWith('BUFFER')
    if (same ? e !== email : e === email) {
      throw new Error(`${role} (${email}) conflicts with ${other} (${e})`)
    }
  }
  if (['A', 'B'].includes(role) && !email.endsWith('@nu.edu.kz')) {
    console.log(`  WARNING: ${role} is ${email}, not an @nu.edu.kz account`)
  }
  emails[role] = email
  console.log(`  ${role} = ${email}`)
  persist()
}

function getToken(role) {
  const hit = loaded.get(role)
  if (hit && hit.exp > Date.now() + 60000) return Promise.resolve(hit.access)
  if (!inflight.has(role)) {
    inflight.set(
      role,
      (async () => {
        const body = await mint(role)
        if (!emails[role]) await identify(role, body.access_token)
        loaded.set(role, {
          access: body.access_token,
          exp: Date.now() + (body.expires_in ?? 3600) * 1000,
        })
        return body.access_token
      })().finally(() => inflight.delete(role))
    )
  }
  return inflight.get(role)
}

const available = (role) => loaded.has(role) || Boolean(cache[role]?.refresh)

// ---------- drive helpers ----------

function crc32(buf) {
  let c
  let crc = 0xffffffff
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function makePng(r, g, b) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(8, 0)
  ihdr.writeUInt32BE(8, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array(8).fill([r, g, b]).flat()),
  ])
  const raw = Buffer.concat(Array(8).fill(row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// rank: delete order (0 files, 1 volume folders, 2 album folders).
function track(entry) {
  const e = { deleted: false, ...entry }
  created.push(e)
  persist()
  return e
}
const entryOf = (id) => created.find((e) => e.id === id)
const isOurs = (id) => Boolean(entryOf(id))
const markOwner = (id, role) => {
  const e = entryOf(id)
  if (e) e.ownerRole = role
  persist()
}
const markDeleted = (id) => {
  const e = entryOf(id)
  if (e) e.deleted = true
  persist()
}

async function createFolder(role, name, parent, rank) {
  const res = await drive(role, '/files?fields=id', {
    method: 'POST',
    ...json({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parent ? { parents: [parent] } : {}),
    }),
  })
  if (!res.ok)
    throw new Error(`create folder ${name} as ${role}: ${describe(res)}`)
  track({ id: res.body.id, name, kind: 'folder', rank, ownerRole: role })
  return res.body.id
}

async function uploadPng(role, name, parent, png) {
  for (let attempt = 1; ; attempt++) {
    const boundary = 'spike' + Math.random().toString(36).slice(2)
    const meta = JSON.stringify({
      name,
      mimeType: 'image/png',
      ...(parent ? { parents: [parent] } : {}),
    })
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n` +
          `--${boundary}\r\nContent-Type: image/png\r\n\r\n`
      ),
      png,
      Buffer.from(`\r\n--${boundary}--`),
    ])
    const res = await drive(
      role,
      `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      }
    )
    if (res.ok) {
      track({ id: res.body.id, name, kind: 'file', rank: 0, ownerRole: role })
      return res.body.id
    }
    if (res.status === 404 && attempt < 4) {
      await sleep(2000)
      continue
    }
    throw new Error(`upload ${name} as ${role}: ${describe(res)}`)
  }
}

const anyoneReader = (role, id) =>
  drive(role, `/files/${id}/permissions`, {
    method: 'POST',
    ...json({ type: 'anyone', role: 'reader' }),
  })

const shareWriter = (role, id, email) =>
  drive(role, `/files/${id}/permissions?sendNotificationEmail=false`, {
    method: 'POST',
    ...json({ type: 'user', role: 'writer', emailAddress: email }),
  })

const listByParent = (role, parent, fields = 'files(id,name)') =>
  drive(role, `/files?q=${q(parent)}&fields=${encodeURIComponent(fields)}`)

const transfer = (role, id, email, extraQuery = '') =>
  drive(role, `/files/${id}/permissions?transferOwnership=true${extraQuery}`, {
    method: 'POST',
    ...json({ type: 'user', role: 'owner', emailAddress: email }),
  })

async function lh3(id) {
  for (let i = 0; i < 2; i++) {
    await sleep(i === 0 ? 3000 : 5000)
    const r = await fetchWithRetry(
      `https://lh3.googleusercontent.com/d/${id}=w100`,
      { redirect: 'follow' }
    )
    const type = r.headers.get('content-type') ?? ''
    await r.arrayBuffer().catch(() => {})
    if (r.ok && type.startsWith('image/'))
      return { ok: true, status: r.status, type }
    if (i === 1) return { ok: false, status: r.status, type }
  }
}

function recLh3(test, check, r) {
  push(
    test,
    check,
    r.ok,
    r.status,
    `logged-out lh3 fetch, content-type ${r.type || 'none'}`
  )
}

// First role whose token can read the file wins.
async function anyView(id, roles, fields) {
  for (const role of roles) {
    if (!available(role)) continue
    const res = await drive(
      role,
      `/files/${id}?fields=${encodeURIComponent(fields)}`
    )
    if (res.ok) return { role, res }
  }
  return null
}

// Standard fixture: album (anyone-reader) > Volume (writer to A) > 2 PNGs by A.
async function fixture(test, beforeUpload) {
  const album = await createFolder('MASTER', NAME(`${test}-album`), null, 2)
  const pub = await anyoneReader('MASTER', album)
  rec(test, 'setup: album folder anyone-reader', pub)
  const volume = await createFolder(
    'MASTER',
    NAME(`${test}-Volume 000001`),
    album,
    1
  )
  await getToken('A')
  const share = await shareWriter('MASTER', volume, emails.A)
  rec(test, 'setup: Volume shared writer with A (no email)', share)
  if (!share.ok) throw new Error('cannot share Volume with A')
  if (beforeUpload) await beforeUpload(volume)
  const files = []
  for (const [i, rgb] of [
    [200, 30, 30],
    [30, 30, 200],
  ].entries()) {
    const name = NAME(`${test}-photo${i + 1}.png`)
    const id = await uploadPng('A', name, volume, makePng(...rgb))
    files.push({ id, name })
  }
  push(
    test,
    'setup: A uploaded 2 PNGs into Volume',
    true,
    null,
    files.map((f) => f.id).join(', ')
  )
  return { album, volume, files }
}

// ---------- tests ----------

async function t1() {
  const T = 'T1'
  const { volume, files } = await fixture(T)
  const [f1, f2] = files
  await getToken('B')
  rec(
    T,
    'master shares Volume with B as writer',
    await shareWriter('MASTER', volume, emails.B)
  )

  const tr = await transfer('A', f1.id, emails.B)
  rec(
    T,
    'A transfers file 1 to B (transferOwnership=true, default email)',
    tr,
    tr.ok
      ? JSON.stringify({
          role: tr.body?.role,
          pendingOwner: tr.body?.pendingOwner,
        })
      : ''
  )
  if (tr.ok) markOwner(f1.id, 'B')

  const tr2 = await transfer(
    'A',
    f2.id,
    emails.B,
    '&sendNotificationEmail=false'
  )
  rec(
    T,
    'A transfers file 2 to B with sendNotificationEmail=false',
    tr2,
    'Docs say email cannot be disabled for ownership transfers'
  )
  if (tr2.ok) markOwner(f2.id, 'B')

  const perms = await drive(
    'MASTER',
    `/files/${volume}/permissions?fields=permissions(id,emailAddress,role)`
  )
  rec(T, 'master lists Volume permissions', perms)
  const aPerm = perms.body?.permissions?.find(
    (p) => p.emailAddress?.toLowerCase() === emails.A
  )
  if (aPerm) {
    rec(
      T,
      'master removes A from the Volume folder',
      await drive('MASTER', `/files/${volume}/permissions/${aPerm.id}`, {
        method: 'DELETE',
      })
    )
  } else {
    push(
      T,
      'master removes A from the Volume folder',
      false,
      null,
      'A permission not found'
    )
  }

  const id = f1.id
  const view = await anyView(
    id,
    ['B', 'MASTER', 'A'],
    'id,parents,owners(emailAddress),trashed'
  )
  if (view) {
    const inVolume = view.res.body.parents?.includes(volume)
    push(
      T,
      'file remains in the Volume folder',
      Boolean(inVolume),
      view.res.status,
      `seen via ${view.role}: parents=${JSON.stringify(view.res.body.parents)} owner=${view.res.body.owners?.[0]?.emailAddress}`
    )
  } else {
    push(
      T,
      'file remains in the Volume folder',
      null,
      null,
      'indeterminate: no drive.file token can read it; check the Drive UI'
    )
  }
  recLh3(T, 'file still publicly readable via lh3 (logged out)', await lh3(id))

  const bGet = await drive('B', `/files/${id}?fields=id,owners(emailAddress)`)
  rec(T, "B's token files.get", bGet)
  const bList = await listByParent('B', volume)
  rec(
    T,
    "B's token files.list by parent",
    bList,
    bList.ok
      ? `${bList.body.files.length} listed, contains file: ${bList.body.files.some((f) => f.id === id)}`
      : ''
  )
  const aGet = await drive('A', `/files/${id}?fields=id,owners(emailAddress)`)
  rec(T, "A's token files.get (after transfer)", aGet)
  const mGet = await drive(
    'MASTER',
    `/files/${id}?fields=id,owners(emailAddress)`
  )
  rec(T, "master's token files.get", mGet)
  const mList = await listByParent('MASTER', volume)
  rec(
    T,
    "master's token files.list by parent",
    mList,
    mList.ok
      ? `${mList.body.files.length} listed, contains file: ${mList.body.files.some((f) => f.id === id)}`
      : ''
  )

  const aDel = await drive('A', `/files/${id}`, { method: 'DELETE' })
  rec(T, "A's token files.delete (after transfer)", aDel)
  if (aDel.ok) markDeleted(id)
  if (!aDel.ok) {
    const bDel = await drive('B', `/files/${id}`, { method: 'DELETE' })
    rec(T, "B's token files.delete", bDel)
    if (bDel.ok) markDeleted(id)
  } else {
    push(
      T,
      "B's token files.delete",
      null,
      null,
      'not tested: A already deleted the file'
    )
  }
  console.log(
    `\n>>> HUMAN: count the emails received. Did ${emails.B} (B) and ${emails.A} (A) each get a transfer email (file 1 default, file 2 with sendNotificationEmail=false)? The API cannot report this.\n`
  )
}

async function t2() {
  const T = 'T2'
  await getToken('A')
  await getToken('BUFFER')
  const aFile = await uploadPng(
    'A',
    NAME('T2-A-root.png'),
    null,
    makePng(10, 200, 10)
  )
  const fwd = await transfer('A', aFile, emails.BUFFER)
  rec(T, 'A transfers its file to BUFFER (cross-org)', fwd, '', 'FAIL')
  if (fwd.ok) markOwner(aFile, 'BUFFER')
  const bFile = await uploadPng(
    'BUFFER',
    NAME('T2-BUFFER-root.png'),
    null,
    makePng(200, 200, 10)
  )
  const back = await transfer('BUFFER', bFile, emails.A)
  rec(T, 'BUFFER transfers its file to A (reverse)', back, '', 'FAIL')
  if (back.ok) markOwner(bFile, 'A')
  if (!fwd.ok)
    console.log(`      exact error A->BUFFER: ${JSON.stringify(fwd.body)}`)
  if (!back.ok)
    console.log(`      exact error BUFFER->A: ${JSON.stringify(back.body)}`)
}

async function bufferCopy(T, role, label) {
  const { album, files } = await fixture(T)
  await getToken('BUFFER')
  const volume = await createFolder(
    'MASTER',
    NAME(`${T}-Volume buffer`),
    album,
    1
  )
  rec(
    T,
    'master shares a new empty Volume with BUFFER as writer',
    await shareWriter('MASTER', volume, emails.BUFFER)
  )
  const src = files[0].id
  const peek = await drive(role, `/files/${src}?fields=id,name`)
  rec(T, `${label} files.get on A's public photo`, peek)
  const copy = await drive(
    role,
    `/files/${src}/copy?fields=id,name,owners(emailAddress),parents`,
    {
      method: 'POST',
      ...json({ name: NAME(`${T}-copy.png`), parents: [volume] }),
    }
  )
  rec(
    T,
    `${label} files.copy into the Volume folder`,
    copy,
    copy.ok ? `owner=${copy.body.owners?.[0]?.emailAddress}` : ''
  )
  if (!copy.ok) return
  const id = copy.body.id
  track({ id, name: copy.body.name, kind: 'file', rank: 0, ownerRole: role })
  recLh3(T, 'copy is public via lh3 (logged out)', await lh3(id))
  const list = await listByParent(role, volume)
  rec(
    T,
    `${label} files.list by parent`,
    list,
    list.ok ? `contains copy: ${list.body.files.some((f) => f.id === id)}` : ''
  )
  if (role !== 'BUFFER') {
    rec(
      T,
      "BUFFER's drive.file token files.get on the copy",
      await drive('BUFFER', `/files/${id}?fields=id,name`)
    )
  }
  const del = await drive(role, `/files/${id}`, { method: 'DELETE' })
  rec(T, `${label} files.delete of the copy`, del)
  if (del.ok) markDeleted(id)
}

const t3a = () => bufferCopy('T3a', 'BUFFER', 'BUFFER (drive.file)')
async function t3b() {
  console.log(
    '\n=== T3b REQUIRES THE RESTRICTED FULL `drive` SCOPE (BUFFER only) ==='
  )
  await bufferCopy('T3b', 'BUFFER_FULL', '[RESTRICTED drive scope] BUFFER')
}

async function listCase(T, label, role, folderLabel, folderId, expectIds) {
  const url = `${API}/files?q=${q(folderId)}&fields=${encodeURIComponent(FILE_FIELDS)}${role ? '' : `&key=${API_KEY}`}`
  const res = await drive(role, url)
  if (!res.ok) return rec(T, `${label}: list ${folderLabel}`, res)
  const items = res.body.files
  const mine = items.filter((f) => expectIds.includes(f.id))
  const sample = mine[0] ?? {}
  push(
    T,
    `${label}: list ${folderLabel}`,
    mine.length === expectIds.length,
    res.status,
    `${items.length} item(s); sees ${mine.length}/${expectIds.length} of A's files; ` +
      `size=${sample.size ?? 'absent'} md5Checksum=${sample.md5Checksum ?? 'absent'} ` +
      `owners=${sample.owners ? sample.owners.map((o) => o.emailAddress).join(',') : 'absent'} ` +
      `mimeType=${sample.mimeType ?? 'absent'}`
  )
}

async function t4() {
  const T = 'T4'
  const { album, volume, files } = await fixture(T)
  const ids = files.map((f) => f.id)
  await sleep(3000)
  if (API_KEY) {
    await listCase(T, 'API key', null, 'Volume', volume, ids)
    await listCase(T, 'API key', null, 'album', album, ids)
    const g = await drive(
      null,
      `${API}/files/${ids[0]}?fields=id,name,size,md5Checksum,owners(emailAddress),mimeType&key=${API_KEY}`
    )
    rec(
      T,
      'API key: files.get on a file',
      g,
      g.ok
        ? `size=${g.body.size ?? 'absent'} md5Checksum=${g.body.md5Checksum ?? 'absent'} owners=${g.body.owners?.map((o) => o.emailAddress).join(',') ?? 'absent'}`
        : ''
    )
  } else {
    push(
      T,
      'API key cases (a)',
      null,
      null,
      'SKIPPED: GOOGLE_DRIVE_API_KEY not set (see usage comment to create one)'
    )
  }
  await listCase(T, "master's drive.file", 'MASTER', 'Volume', volume, ids)
  await listCase(T, "master's drive.file", 'MASTER', 'album', album, ids)
  await listCase(T, "A's drive.file", 'A', 'Volume', volume, ids)
  await listCase(T, "A's drive.file", 'A', 'album', album, ids)
}

async function t5() {
  const T = 'T5'
  const { volume, files } = await fixture(T)
  const list = await listByParent('A', volume)
  rec(
    T,
    "A's token lists the Volume folder by parent",
    list,
    list.ok ? `${list.body.files.length} file(s)` : ''
  )
  if (!list.ok || !list.body.files.length) return
  const target = list.body.files.find((f) => files.some((x) => x.id === f.id))
  if (!target || !isOurs(target.id)) {
    push(
      T,
      'pick a listed file to delete',
      false,
      null,
      'listed files were not created by this run; refusing to delete'
    )
    return
  }
  const del = await drive('A', `/files/${target.id}`, { method: 'DELETE' })
  rec(T, 'A deletes the file using the ID returned by the listing', del)
  if (!del.ok) return
  markDeleted(target.id)
  const get = await drive('A', `/files/${target.id}?fields=id`)
  push(
    T,
    'file is gone (files.get)',
    get.status === 404,
    get.status,
    describe(get)
  )
  const again = await listByParent('A', volume)
  push(
    T,
    'file is gone (not in parent listing)',
    again.ok && !again.body.files.some((f) => f.id === target.id),
    again.status,
    again.ok ? `${again.body.files.length} file(s) left` : describe(again)
  )
}

async function t6() {
  const T = 'T6'
  const { files } = await fixture(T)
  await getToken('BUFFER')
  const g1 = await drive('BUFFER', `/files/${files[0].id}?alt=media`)
  push(
    T,
    "BUFFER's token downloads A's public file (alt=media)",
    g1.ok,
    g1.status,
    describe(g1)
  )
  const bId = await uploadPng(
    'BUFFER',
    NAME('T6-BUFFER-public.png'),
    null,
    makePng(120, 40, 160)
  )
  rec(T, 'BUFFER makes its own file public', await anyoneReader('BUFFER', bId))
  const g2 = await drive('A', `/files/${bId}?alt=media`)
  push(
    T,
    "A's token downloads BUFFER's public file (alt=media)",
    g2.ok,
    g2.status,
    describe(g2)
  )
}

// Owner's folder recipe: hand the Volume folder to B and back, through the API.
async function folderRecipe(T, shareBWhileEmpty) {
  await getToken('B')
  await getToken('MASTER')
  const { album, volume, files } = await fixture(
    T,
    shareBWhileEmpty
      ? async (id) =>
          rec(
            T,
            'master shares the still empty Volume with B',
            await shareWriter('MASTER', id, emails.B)
          )
      : undefined
  )
  const probe = async (label) => {
    for (const [role, id, name] of [
      ...files.map((f) => ['photo', f.id, f.name]),
      ['folder', volume, 'Volume'],
    ]) {
      const view = await anyView(
        id,
        ['BUFFER_FULL', 'MASTER', 'A', 'B'],
        'id,parents,owners(emailAddress)'
      )
      push(
        T,
        `${label}: ${role} ${name}`,
        null,
        view?.res.status ?? null,
        view
          ? `via ${view.role}: owner=${view.res.body.owners?.[0]?.emailAddress} parents=${JSON.stringify(view.res.body.parents)}`
          : 'no token can read it'
      )
    }
  }
  await probe('start')

  if (!shareBWhileEmpty) {
    rec(
      T,
      '1. master adds B as editor on the Volume',
      await shareWriter('MASTER', volume, emails.B)
    )
  }

  const toB = await transfer('MASTER', volume, emails.B)
  rec(T, '2. master transfers the Volume folder to B', toB)
  if (toB.ok) markOwner(volume, 'B')
  await probe('after step 2')

  const perms = await drive(
    'MASTER',
    `/files/${volume}/permissions?fields=permissions(id,emailAddress,role)`
  )
  rec(T, 'master lists Volume permissions', perms)
  const aPerm = perms.body?.permissions?.find(
    (p) => p.emailAddress?.toLowerCase() === emails.A
  )
  for (const role of ['MASTER', 'B']) {
    if (!aPerm) break
    const res = await drive(role, `/files/${volume}/permissions/${aPerm.id}`, {
      method: 'DELETE',
    })
    rec(T, `3. ${role} removes A from the Volume`, res)
    if (res.ok) break
  }

  rec(
    T,
    "B's token files.get on the Volume folder",
    await drive('B', `/files/${volume}?fields=id,owners(emailAddress)`)
  )
  const back = await transfer('B', volume, emails.MASTER)
  rec(T, '4. B transfers the Volume folder back to master', back)
  if (back.ok) markOwner(volume, 'MASTER')
  await probe('after step 4')

  const where = await anyView(
    volume,
    ['BUFFER_FULL', 'MASTER', 'A', 'B'],
    'parents'
  )
  if (where && !where.res.body.parents?.includes(album)) {
    const old = (where.res.body.parents ?? []).join(',')
    rec(
      T,
      '5. master moves the Volume back into the album folder',
      await drive(
        'MASTER',
        `/files/${volume}?addParents=${album}&removeParents=${old}`,
        { method: 'PATCH', ...json({}) }
      )
    )
  } else {
    push(
      T,
      '5. Volume is still in the album folder',
      where ? true : null,
      null,
      where ? 'no move needed' : 'no token can read it'
    )
  }

  const shortcutFields = 'files(id,name,mimeType,owners(emailAddress))'
  for (const role of ['BUFFER_FULL', 'MASTER']) {
    if (!available(role)) continue
    const list = await listByParent(role, album, shortcutFields)
    rec(
      T,
      `6. ${role} lists album children (shortcuts visible?)`,
      list,
      list.ok ? JSON.stringify(list.body.files) : ''
    )
  }
  const bList = await drive(
    'B',
    `/files?q=${encodeURIComponent("mimeType='application/vnd.google-apps.shortcut'")}&fields=${encodeURIComponent(shortcutFields)}`
  )
  rec(
    T,
    "7. B's token lists its shortcuts",
    bList,
    bList.ok ? `${bList.body.files.length} visible` : ''
  )

  await probe('end')
  recLh3(T, 'photo still public via lh3', await lh3(files[0].id))
  for (const role of ['A', 'B', 'MASTER']) {
    const res = await drive(role, `/files/${files[0].id}`, { method: 'DELETE' })
    rec(T, `${role}'s token deletes photo 1`, res)
    if (res.ok) {
      markDeleted(files[0].id)
      break
    }
  }
}

const RUNNERS = {
  T1: t1,
  T2: t2,
  T3A: t3a,
  T3B: t3b,
  T4: t4,
  T5: t5,
  T6: t6,
  T7: () => folderRecipe('T7', false),
  T7B: () => folderRecipe('T7b', true),
}

// ---------- cleanup ----------

async function cleanup() {
  const todo = created
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !e.deleted)
    .sort((x, y) => x.e.rank - y.e.rank || y.i - x.i)
    .map(({ e }) => e)
  console.log(`\nCleanup: ${todo.length} item(s), files first, then folders.`)
  for (const e of todo) {
    const order = [
      e.ownerRole,
      ...ROLES.filter((r) => r !== e.ownerRole),
    ].filter((r) => available(r) || (r === e.ownerRole && r !== 'BUFFER_FULL'))
    const tried = []
    for (const role of order) {
      let res
      try {
        res = await drive(role, `/files/${e.id}`, { method: 'DELETE' })
      } catch (err) {
        tried.push(`${role}: ${err.message}`)
        continue
      }
      if (res.ok) {
        e.deleted = true
        break
      }
      tried.push(`${role}: ${describe(res)}`)
    }
    if (!e.deleted) {
      const owner =
        emails[e.ownerRole] ?? cache[e.ownerRole]?.hint ?? e.ownerRole
      leftovers.push({ id: e.id, name: e.name, kind: e.kind, owner, tried })
      console.log(
        `  could not delete ${e.kind} ${e.id} (${e.name}), owner ${owner}: ${tried.join('; ')}`
      )
    }
    persist()
  }
}

function printSummary() {
  const rows = results.map((r) => [
    r.test,
    r.check,
    r.ok === true ? 'PASS' : r.ok === false ? 'FAIL' : 'INFO',
    r.expected ? `exp ${r.expected}` : '',
    r.status ?? '-',
    r.detail,
  ])
  const head = ['Test', 'Check', 'Result', 'Expect', 'HTTP', 'Detail']
  const clip = (s, n) =>
    String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s)
  const widths = [6, 62, 6, 9, 5, 70]
  const line = (cells) =>
    cells.map((c, i) => clip(c, widths[i]).padEnd(widths[i])).join('  ')
  console.log('\n=== Summary ===')
  console.log(
    'PASS = call succeeded / condition true; FAIL = call failed / condition false; INFO = indeterminate or skipped.'
  )
  console.log(line(head))
  for (const row of rows) console.log(line(row))
}

async function finish() {
  try {
    await cleanup()
  } catch (err) {
    console.log(`cleanup crashed: ${err.message}`)
  }
  persist()
  printSummary()
  console.log(`\nResults JSON: ${currentPath}`)
  if (leftovers.length) {
    console.log(
      `\nLEFTOVERS (${leftovers.length}): delete these by hand in the Drive UI of the owner, or retry:`
    )
    console.log(
      `  node scripts/spike-buffer-drain.mjs --cleanup-only ${currentPath}`
    )
    for (const l of leftovers)
      console.log(`  ${l.kind} ${l.id} ${l.name} owner ${l.owner}`)
    console.log(
      '(drive.file tokens often cannot see files that changed owner; names start with spike-buffer-)'
    )
  } else {
    console.log('Cleanup complete: nothing left over.')
  }
  console.log(
    `Token cache: ${CACHE_PATH} (remove with --forget-tokens; revoke app access when finished)`
  )
  if (server) server.close()
}

// ---------- main ----------

let finishing = false
process.on('SIGINT', async () => {
  if (finishing) process.exit(130)
  finishing = true
  console.log('\nInterrupted; cleaning up.')
  await finish()
  process.exit(130)
})

async function main() {
  const resumePath = arg('--cleanup-only')
  if (resumePath) {
    const prev = JSON.parse(readFileSync(resumePath, 'utf8'))
    currentPath = resumePath
    created.push(...prev.created)
    Object.assign(emails, prev.accounts ?? {})
    results.push(...(prev.results ?? []))
    finishing = true
    await finish()
    return
  }
  const tests = selectedTests()
  console.log(`Run ${RUN_ID}; tests: ${tests.join(', ')}`)
  console.log(
    `API key for T4a: ${API_KEY ? 'present' : 'absent (T4a will be skipped)'}`
  )
  try {
    for (const t of tests) {
      console.log(`\n===== ${t} =====`)
      try {
        await RUNNERS[t]()
      } catch (err) {
        push(t, 'test aborted', false, null, err.message)
      }
    }
  } finally {
    finishing = true
    await finish()
  }
}

main().catch(async (err) => {
  console.error('\nERROR:', err.message)
  process.exitCode = 1
  if (server) server.close()
})
