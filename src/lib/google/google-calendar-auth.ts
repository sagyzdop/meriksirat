/**
 * Get an access token using the refresh token via HTTP/REST
 * Reference: https://developers.google.com/identity/protocols/oauth2/web-server#httprest
 *
 * Google access tokens live for 1 hour. Refreshing on every call would double
 * the outbound request count of every Google API operation (and burn Worker
 * CPU + bandwidth on the free tier), so the token is cached in memory for
 * ~50 minutes and only refreshed after that.
 *
 * IMPORTANT: this module must never import `cloudflare:workers` (or any other
 * server binding). It is statically reachable from modules that are bundled
 * into the client (the Telegram webhook chain), and an unresolved
 * `cloudflare:workers` import breaks the client build.
 */

let cachedToken: string | null = null
let cachedAt = 0

const TOKEN_TTL_MS = 50 * 60 * 1000

async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh access token: ${error}`)
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

export async function getGoogleAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_MASTER_REFRESH_TOKEN

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set')
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET not set')
  if (!refreshToken) throw new Error('GOOGLE_MASTER_REFRESH_TOKEN not set')

  if (cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) {
    return cachedToken
  }

  const accessToken = await refreshGoogleAccessToken(
    clientId,
    clientSecret,
    refreshToken
  )

  cachedToken = accessToken
  cachedAt = Date.now()

  return accessToken
}
