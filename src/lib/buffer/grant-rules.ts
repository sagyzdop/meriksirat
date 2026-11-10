export type BufferGrantStatus = 'active' | 'pending' | 'retiring'
export type BufferState = 'ok' | 'auth_failed' | 'quota_full' | 'missing'

export const RETIRE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
export const BUFFER_SCOPE = 'https://www.googleapis.com/auth/drive'

export function bufferCallbackUrl(origin: string): string {
  return `${origin}/api/buffer/callback`
}

export function hasFullDriveScope(scope: string | undefined): boolean {
  return (scope ?? '').split(/\s+/).includes(BUFFER_SCOPE)
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function isBufferEmail(
  email: string | null | undefined,
  bufferEmails: Iterable<string | null | undefined>
): boolean {
  const target = normalizeEmail(email)
  if (!target) return false
  for (const candidate of bufferEmails) {
    if (normalizeEmail(candidate) === target) return true
  }
  return false
}

export const BUFFER_ACCOUNT_MESSAGE =
  'This Google account stores the club photos and cannot be used to sign in or become a flamekeeper.'

export type ConnectRefusal =
  | 'master'
  | 'user'
  | 'flamekeeper'
  | 'scope'
  | 'token'
  | 'state'
  | 'denied'
  | 'session'
  | 'unverified'
  | 'busy'

export const BUFFER_CONNECT_MESSAGES: Record<ConnectRefusal, string> = {
  master: 'The club account owns the album folders and cannot be the buffer.',
  user: 'This Google account is registered in the app. The buffer must be a separate account that nobody signs in with.',
  flamekeeper: 'This Google account is a flamekeeper and cannot be the buffer.',
  scope: 'Full Google Drive access was not granted. Allow it and try again.',
  token: 'Google did not return a usable authorization. Please try again.',
  state: 'The connection request expired. Please start again.',
  denied: 'Google access was not granted. You can try again.',
  session: 'Your session changed during the connection. Please start again.',
  unverified: 'Google did not confirm this account email. Please try again.',
  busy: 'A buffer switch is already in progress. Cancel it before connecting another account.',
}

export function refuseBufferAccount(input: {
  email: string
  masterEmail: string | null | undefined
  isRegisteredUser: boolean
  isFlamekeeper: boolean
}): ConnectRefusal | null {
  if (normalizeEmail(input.email) === normalizeEmail(input.masterEmail)) {
    return 'master'
  }
  if (input.isFlamekeeper) return 'flamekeeper'
  if (input.isRegisteredUser) return 'user'
  return null
}

export type ConnectPlan =
  { kind: 'replace-active' } | { kind: 'adopt-legacy' } | { kind: 'pending' }

/**
 * Connecting the account that already is the buffer only swaps its token. The
 * first DB grant of the account the env tokens already point at adopts the
 * legacy volumes. Any other account becomes the pending switch target.
 */
export function planConnect(input: {
  email: string
  active: { email: string } | null
  legacyEmail: string
}): ConnectPlan {
  const email = normalizeEmail(input.email)
  if (input.active) {
    return normalizeEmail(input.active.email) === email
      ? { kind: 'replace-active' }
      : { kind: 'pending' }
  }
  return normalizeEmail(input.legacyEmail) === email
    ? { kind: 'adopt-legacy' }
    : { kind: 'pending' }
}

export function needsMigration(
  volumeGrantId: string | null,
  targetGrantId: string
): boolean {
  return volumeGrantId !== targetGrantId
}

/**
 * Dropped volumes a switch may finish instead of copying from scratch, best
 * first: the original the source was itself copied from (switching back), then
 * a copy an earlier run started. Keys are grant ids, the env tokens included.
 */
export function reusableVolumeIds(
  source: { id: string; grantKey: string },
  targetKey: string
): string[] {
  const suffix = `~${source.grantKey}`
  const ids: string[] = []
  if (source.id.endsWith(suffix)) ids.push(source.id.slice(0, -suffix.length))
  ids.push(`${source.id}~${targetKey}`)
  return ids
}

export function canRetire(
  grant: { status: BufferGrantStatus; retireAfter: Date | null },
  referencedVolumes: number,
  now: Date
): boolean {
  if (grant.status !== 'retiring') return false
  if (referencedVolumes > 0) return false
  return !!grant.retireAfter && grant.retireAfter.getTime() <= now.getTime()
}

export function stateForError(error: unknown): BufferState | null {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('Failed to refresh buffer access token')) {
    return 'auth_failed'
  }
  if (error instanceof Error) {
    if (error.name === 'DriveAuthError') return 'auth_failed'
    if (error.name === 'DriveQuotaExceededError') return 'quota_full'
  }
  return null
}

export const BUFFER_STATE_LABELS: Record<BufferState, string> = {
  ok: 'Connected',
  auth_failed: 'Access lost, reconnect the account',
  quota_full: 'Drive storage is full',
  missing: 'Volume folders are missing',
}

export function bufferStateAlertText(
  state: Exclude<BufferState, 'ok'>,
  email: string
): string {
  switch (state) {
    case 'auth_failed':
      return `#savenuimg buffer account ${email} lost access (revoked or password reset). Uploads and reads of buffer photos are failing. Reconnect it in Settings > Storage.`
    case 'quota_full':
      return `#savenuimg buffer account ${email} has no Drive storage left. Uploads are paused until space is freed.`
    case 'missing':
      return `#savenuimg buffer account ${email} cannot find some album volume folders in Drive. Check Settings > Storage.`
  }
}
