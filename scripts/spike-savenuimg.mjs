/**
 * Throwaway spike for #savenuimg (issue #1, Phase 0). Answers four Drive
 * questions with two real @nu.edu.kz accounts (A and B) before any feature
 * code is written. Creates a few tiny test files and deletes them at the end.
 *
 *   Q1  After A transfers a drive.file-created file to B, can B's drive.file
 *       token still read it, change its permissions and delete it?
 *   Q2  Can a browser download a file with A's token (alt=media, CORS) and
 *       upload it straight into B's Drive? (optional: public download with
 *       an API key, for lost flamekeepers)
 *   Q3  Can a drive.file token create a shortcut to a folder another account
 *       owns? (tried with the master token, then with B)
 *   Q4  Does about.get report the per-user cap or the org-wide pool?
 *
 * Usage:
 *   node scripts/spike-savenuimg.mjs
 *   node scripts/spike-savenuimg.mjs --redirect-uri http://localhost/api/auth/callback/google
 *   SPIKE_API_KEY=... node scripts/spike-savenuimg.mjs   # also test API-key download
 *
 * Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env, and
 * the redirect URI (default http://localhost:8788/oauth, or --redirect-uri)
 * registered on the OAuth client (the same default one
 * google-mint-token.mjs uses). GOOGLE_MASTER_REFRESH_TOKEN is optional (Q3).
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

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env
for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
  if (!process.env[key]) throw new Error(`${key} is not set in .env`)
}

const argRedirect = process.argv.indexOf('--redirect-uri')
const REDIRECT_URI =
  argRedirect !== -1
    ? process.argv[argRedirect + 1]
    : 'http://localhost:8788/oauth'
const redirect = new URL(REDIRECT_URI)
const PORT = Number(redirect.port || 80)
const ORIGIN = redirect.origin
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file']
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const results = []
const cleanup = []
const pending = new Map()
let relay = null

function record(id, question, ok, detail) {
  results.push({ id, question, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${question}\n      ${detail}`)
}

async function drive(token, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  })
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { ok: response.ok, status: response.status, body, response }
}

function describe(res) {
  if (res.ok) return `HTTP ${res.status}`
  const error = res.body?.error
  const reason = error?.errors?.[0]?.reason ?? error?.status ?? ''
  return `HTTP ${res.status} ${reason} ${error?.message ?? ''}`.trim()
}

async function createFolder(token, name, parent) {
  const res = await drive(token, `${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parent ? { parents: [parent] } : {}),
    }),
  })
  if (res.ok) cleanup.push({ token, id: res.body.id })
  return res
}

async function uploadPng(token, name, parent) {
  const boundary = 'spike' + Math.random().toString(36).slice(2)
  const meta = JSON.stringify({
    name,
    mimeType: 'image/png',
    parents: [parent],
  })
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\nContent-Type: image/png\r\n\r\n`
    ),
    PNG,
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const res = await drive(
    token,
    `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  )
  if (!res.ok) throw new Error(`upload failed: ${describe(res)}`)
  cleanup.push({ token, id: res.body.id })
  return res.body.id
}

async function setAnyoneReader(token, id) {
  return drive(token, `${API}/files/${id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'anyone', role: 'reader' }),
  })
}

async function refreshMasterToken() {
  const refreshToken = process.env.GOOGLE_MASTER_REFRESH_TOKEN
  if (!refreshToken) return null
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  return (await response.json()).access_token
}

function signIn(label) {
  const state = `${label}-${Math.random().toString(36).slice(2)}`
  const url =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES.join(' '),
      prompt: 'select_account consent',
      state,
    })
  console.log(`\n>>> Sign in as account ${label} (an @nu.edu.kz account).`)
  spawn('open', [url], { stdio: 'ignore' })
  return new Promise((resolve, reject) => {
    pending.set(state, { resolve, reject })
  })
}

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
  if (!response.ok) throw new Error(await response.text())
  return (await response.json()).access_token
}

const relayPage = () => `<!doctype html>
<meta charset="utf-8"><title>savenuimg spike: browser relay</title>
<body style="font:16px system-ui;padding:24px">
<h1>Browser relay test</h1><pre id="log">running…</pre>
<script>
const cfg = ${JSON.stringify(relay)}
const log = (m) => (document.getElementById('log').textContent += '\\n' + m)
async function attempt(name, fn) {
  try { const d = await fn(); log('PASS ' + name + ': ' + d); return { name, ok: true, detail: d } }
  catch (e) { log('FAIL ' + name + ': ' + e); return { name, ok: false, detail: String(e) } }
}
;(async () => {
  const out = []
  let bytes
  out.push(await attempt('download-with-token', async () => {
    const r = await fetch('https://www.googleapis.com/drive/v3/files/' + cfg.fileId + '?alt=media',
      { headers: { Authorization: 'Bearer ' + cfg.sourceToken } })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    bytes = await r.blob()
    return bytes.size + ' bytes'
  }))
  out.push(await attempt('upload-to-destination', async () => {
    if (!bytes) throw new Error('no bytes downloaded')
    const r = await fetch(cfg.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: bytes })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return 'new file ' + (await r.json()).id
  }))
  if (cfg.apiKey) out.push(await attempt('public-download-with-api-key', async () => {
    const r = await fetch('https://www.googleapis.com/drive/v3/files/' + cfg.fileId + '?alt=media&key=' + cfg.apiKey)
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return (await r.blob()).size + ' bytes'
  }))
  await fetch('/report', { method: 'POST', body: JSON.stringify(out) })
  log('\\nDone — back to the terminal.')
})()
</script>`

const server = createServer((req, res) => {
  const url = new URL(req.url, ORIGIN)
  if (url.pathname === redirect.pathname) {
    const entry = pending.get(url.searchParams.get('state'))
    const code = url.searchParams.get('code')
    if (!entry || !code) {
      res.writeHead(400)
      res.end(`OAuth error: ${url.searchParams.get('error') ?? 'bad state'}`)
      return
    }
    pending.delete(url.searchParams.get('state'))
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<h1>Signed in. You can close this tab.</h1>')
    exchangeCode(code).then(entry.resolve, entry.reject)
    return
  }
  if (url.pathname === '/relay' && relay) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(relayPage())
    return
  }
  if (url.pathname === '/report' && req.method === 'POST' && relay) {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      res.writeHead(204)
      res.end()
      relay.done(JSON.parse(body))
    })
    return
  }
  res.writeHead(404)
  res.end('Not found')
})

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve))
  console.log(
    `Listening on ${ORIGIN} (OAuth client ...${GOOGLE_CLIENT_ID.slice(-8)})`
  )

  const tokenA = await signIn('A')
  const tokenB = await signIn('B')
  const aboutA = await drive(tokenA, `${API}/about?fields=user,storageQuota`)
  const aboutB = await drive(tokenB, `${API}/about?fields=user,storageQuota`)
  const emailA = aboutA.body?.user?.emailAddress
  const emailB = aboutB.body?.user?.emailAddress
  if (!emailA || !emailB || emailA === emailB) {
    throw new Error(`Need two different accounts, got ${emailA} and ${emailB}`)
  }
  console.log(`\nA = ${emailA}\nB = ${emailB}\n`)

  const gb = (n) => (n == null ? 'none' : `${(Number(n) / 1e9).toFixed(2)} GB`)
  for (const [label, about] of [
    ['A', aboutA],
    ['B', aboutB],
  ]) {
    const q = about.body.storageQuota
    record(
      'Q4',
      `about.get storageQuota for ${label}`,
      about.ok,
      `limit=${gb(q.limit)} usage=${gb(q.usage)} usageInDrive=${gb(q.usageInDrive)} ` +
        '(≈20 GB means per-user cap; a huge or missing limit means the org pool)'
    )
  }

  const folderA = await createFolder(tokenA, 'savenuimg-spike-A')
  if (!folderA.ok)
    throw new Error(`A cannot create a folder: ${describe(folderA)}`)
  const folderB = await createFolder(tokenB, 'savenuimg-spike-B')
  if (!folderB.ok)
    throw new Error(`B cannot create a folder: ${describe(folderB)}`)
  await setAnyoneReader(tokenA, folderA.body.id)

  const fileT = await uploadPng(tokenA, 'transfer-me.png', folderA.body.id)
  const transfer = await drive(
    tokenA,
    `${API}/files/${fileT}/permissions?transferOwnership=true`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'user',
        role: 'owner',
        emailAddress: emailB,
      }),
    }
  )
  record('Q1', 'A transfers ownership to B', transfer.ok, describe(transfer))
  if (transfer.ok) {
    cleanup.push({ token: tokenB, id: fileT })
    const read = await drive(
      tokenB,
      `${API}/files/${fileT}?fields=id,owners(emailAddress)`
    )
    record(
      'Q1',
      "B's token reads the transferred file",
      read.ok,
      read.ok
        ? `owner now ${read.body.owners?.[0]?.emailAddress}, same id`
        : describe(read)
    )
    const perm = await setAnyoneReader(tokenB, fileT)
    record('Q1', "B's token changes its permissions", perm.ok, describe(perm))
    const rename = await drive(tokenB, `${API}/files/${fileT}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'transferred.png' }),
    })
    record('Q1', "B's token renames it", rename.ok, describe(rename))
    const del = await drive(tokenB, `${API}/files/${fileT}`, {
      method: 'DELETE',
    })
    record('Q1', "B's token deletes it", del.ok, describe(del))
  }

  const masterToken = await refreshMasterToken()
  const shortcutOwners = masterToken
    ? [
        ['master', masterToken],
        ['B', tokenB],
      ]
    : [['B', tokenB]]
  if (!masterToken)
    console.log('(no usable GOOGLE_MASTER_REFRESH_TOKEN; Q3 runs with B only)')
  for (const [label, token] of shortcutOwners) {
    const root =
      label === 'B'
        ? folderB
        : await createFolder(token, 'savenuimg-spike-root')
    if (!root.ok) {
      record(
        'Q3',
        `${label} creates a root folder`,
        false,
        `${describe(root)} (over quota?)`
      )
      continue
    }
    const shortcut = await drive(token, `${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Part 1',
        mimeType: 'application/vnd.google-apps.shortcut',
        parents: [root.body.id],
        shortcutDetails: { targetId: folderA.body.id },
      }),
    })
    if (shortcut.ok) cleanup.push({ token, id: shortcut.body.id })
    record(
      'Q3',
      `${label} creates a shortcut to A's folder`,
      shortcut.ok,
      describe(shortcut)
    )
  }

  const fileR = await uploadPng(tokenA, 'relay-me.png', folderA.body.id)
  const session = await drive(
    tokenB,
    `${UPLOAD_API}/files?uploadType=resumable`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'image/png',
        Origin: ORIGIN,
      },
      body: JSON.stringify({ name: 'relayed.png', parents: [folderB.body.id] }),
    }
  )
  const uploadUrl = session.response.headers.get('Location')
  if (!uploadUrl)
    throw new Error(`B cannot start an upload: ${describe(session)}`)
  const relayResults = await new Promise((done) => {
    relay = {
      fileId: fileR,
      sourceToken: tokenA,
      uploadUrl,
      apiKey: process.env.SPIKE_API_KEY ?? null,
      done,
    }
    console.log(`\n>>> Opening ${ORIGIN}/relay for the browser test…`)
    spawn('open', [`${ORIGIN}/relay`], { stdio: 'ignore' })
  })
  for (const r of relayResults)
    record('Q2', `browser: ${r.name}`, r.ok, r.detail)
  if (!process.env.SPIKE_API_KEY) {
    console.log('(SPIKE_API_KEY not set; API-key public download not tested)')
  }
}

async function runCleanup() {
  const listed = await Promise.all(
    cleanup
      .reverse()
      .map(({ token, id }) =>
        drive(token, `${API}/files/${id}`, { method: 'DELETE' })
      )
  )
  const left = listed.filter((r) => !r.ok && r.status !== 404).length
  console.log(
    `\nCleanup: deleted test files (${left} could not be deleted; check Drive for "savenuimg-spike").`
  )
}

main()
  .catch((err) => console.error('\nERROR:', err.message))
  .finally(async () => {
    await runCleanup()
    console.log('\n=== Summary ===')
    for (const r of results) {
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.question}`)
    }
    server.close()
    process.exit(0)
  })
