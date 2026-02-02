/**
 * Get an access token using the refresh token via HTTP/REST
 * Reference: https://developers.google.com/identity/protocols/oauth2/web-server#httprest
 */
export async function getGoogleAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_MASTER_REFRESH_TOKEN

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set')
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET not set')
  if (!refreshToken) throw new Error('GOOGLE_MASTER_REFRESH_TOKEN not set')

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

  const data = await response.json() as { access_token: string }
  return data.access_token
}
