import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { withTokenRetry } from '@/lib/google/token-retry'

const TOKEN_TTL_MS = 50 * 60 * 1000

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
    throw new Error(
      `Failed to refresh buffer access token: ${await response.text()}`
    )
  }
  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

let cachedToken: string | null = null
let cachedAt = 0

function hasCached(): boolean {
  return !!cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS
}

export async function getBufferAccessToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_BUFFER_REFRESH_TOKEN
  if (!refreshToken) throw new Error('GOOGLE_BUFFER_REFRESH_TOKEN not set')
  if (cachedToken && hasCached()) return cachedToken
  cachedToken = await refreshBufferAccessToken(refreshToken)
  cachedAt = Date.now()
  return cachedToken
}

export function forgetBufferAccessToken(): void {
  cachedToken = null
  cachedAt = 0
}

export function withBufferToken<T>(
  run: (token: string) => Promise<T>,
  budget?: Budget
): Promise<T> {
  return withTokenRetry(
    {
      getToken: getBufferAccessToken,
      forget: forgetBufferAccessToken,
      hasCached,
      canRetry: () => takeIfBudgeted(budget, 2),
    },
    run
  )
}
