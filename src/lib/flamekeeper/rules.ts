export const GB = 1024 * 1024 * 1024
export const MIN_PLEDGE_GB = 1
export const MIN_PLEDGE_BYTES = MIN_PLEDGE_GB * GB
export const MAX_PLEDGE_GB = 1024
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const FLAMEKEEPER_SCOPES = [DRIVE_FILE_SCOPE, 'openid', 'email']
export const DRAIN_GRACE_MS = 14 * 24 * 60 * 60 * 1000
export const FLAMEKEEPER_TERMS_URL =
  'https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md#14-flamekeepers'

export function gbToBytes(gb: number): number {
  return Math.round(gb * GB)
}

export function bytesToGb(bytes: number): number {
  return bytes / GB
}

export function formatGb(bytes: number): string {
  const gb = bytesToGb(bytes)
  return `${gb >= 10 || Number.isInteger(gb) ? gb.toFixed(0) : gb.toFixed(1)} GB`
}

export function isValidPledgeGb(gb: number): boolean {
  return Number.isFinite(gb) && gb >= MIN_PLEDGE_GB && gb <= MAX_PLEDGE_GB
}

export function isValidGraduationDate(
  value: string,
  now: Date = new Date()
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  if (parsed.toISOString().slice(0, 10) !== value) return false
  return parsed.getTime() > now.getTime()
}

export function pledgeLowerThanUsed(
  pledgedBytes: number,
  usedBytes: number
): boolean {
  return pledgedBytes < usedBytes
}

export function isNuEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@nu.edu.kz')
}

export function driveAccountMatches(
  googleEmail: string | null | undefined,
  userEmail: string
): boolean {
  if (!googleEmail) return false
  const google = googleEmail.trim().toLowerCase()
  return google === userEmail.trim().toLowerCase() && isNuEmail(google)
}

export function hasDriveFileScope(scope: string | null | undefined): boolean {
  return (scope ?? '').split(/\s+/).includes(DRIVE_FILE_SCOPE)
}

export function decodeIdTokenPayload(
  idToken: string
): { email?: string; email_verified?: boolean; sub?: string } | null {
  const part = idToken.split('.')[1]
  if (!part) return null
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

export function flamekeeperCallbackUrl(origin: string): string {
  return `${origin}/api/flamekeeper/callback`
}

export function buildDriveAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  loginHint?: string
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', FLAMEKEEPER_SCOPES.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', params.state)
  if (params.loginHint) url.searchParams.set('login_hint', params.loginHint)
  return url.toString()
}

export type ConnectErrorCode =
  'denied' | 'state' | 'session' | 'account' | 'scope' | 'token'

export const CONNECT_ERROR_MESSAGES: Record<ConnectErrorCode, string> = {
  denied: 'Google access was not granted. You can try again.',
  state: 'The connection request expired. Please start again.',
  session: 'Your session changed during the connection. Please start again.',
  account:
    'Connect Drive with the same @nu.edu.kz Google account you signed in with.',
  scope: 'The Drive permission was not granted. Please allow file access.',
  token: 'Google did not return a usable authorization. Please try again.',
}
