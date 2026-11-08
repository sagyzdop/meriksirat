import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { withTokenRetry } from '@/lib/google/token-retry'
import {
  clearState,
  peekActiveGrantId,
  resolveBufferGrant,
  setBufferGrantState,
} from './grant'
import { stateForError } from './grant-rules'

const TOKEN_TTL_MS = 50 * 60 * 1000

export class BufferRefreshError extends Error {
  constructor(
    message: string,
    readonly revoked: boolean
  ) {
    super(message)
    this.name = 'BufferRefreshError'
  }
}

export async function refreshBufferAccessToken(
  refreshToken: string
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set')
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET not set')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new BufferRefreshError(
      `Failed to refresh buffer access token: ${body}`,
      response.status === 400 || response.status === 401
    )
  }
  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

const cache = new Map<string, { token: string; at: number }>()

function keyOf(grantId?: string | null): string {
  return grantId ?? peekActiveGrantId()
}

function hasCached(grantId?: string | null): boolean {
  const hit = cache.get(keyOf(grantId))
  return !!hit && Date.now() - hit.at < TOKEN_TTL_MS
}

export async function getBufferAccessToken(
  grantId?: string | null
): Promise<string> {
  const grant = await resolveBufferGrant(grantId)
  if (!grant) throw new Error('Buffer account is not connected')
  const hit = cache.get(grant.id)
  if (hit && Date.now() - hit.at < TOKEN_TTL_MS) return hit.token
  try {
    const token = await refreshBufferAccessToken(grant.refreshToken)
    cache.set(grant.id, { token, at: Date.now() })
    await clearState(grant.id, 'auth_failed').catch(() => undefined)
    return token
  } catch (error) {
    if (error instanceof BufferRefreshError && error.revoked) {
      await setBufferGrantState(grant.id, 'auth_failed').catch(() => undefined)
    }
    throw error
  }
}

export function forgetBufferAccessToken(grantId?: string | null): void {
  cache.delete(keyOf(grantId))
}

export async function withBufferToken<T>(
  run: (token: string) => Promise<T>,
  budget?: Budget,
  grantId?: string | null
): Promise<T> {
  try {
    return await withTokenRetry(
      {
        getToken: () => getBufferAccessToken(grantId),
        forget: () => forgetBufferAccessToken(grantId),
        hasCached: () => hasCached(grantId),
        canRetry: () => takeIfBudgeted(budget, 2),
      },
      run
    )
  } catch (error) {
    const state = stateForError(error)
    if (state && state !== 'auth_failed') {
      const grant = await resolveBufferGrant(grantId).catch(() => null)
      if (grant)
        await setBufferGrantState(grant.id, state).catch(() => undefined)
    }
    throw error
  }
}
