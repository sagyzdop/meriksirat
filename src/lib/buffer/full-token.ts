import { refreshBufferAccessToken } from './tokens'

const TOKEN_TTL_MS = 50 * 60 * 1000

let cachedToken: string | null = null
let cachedAt = 0

export async function getBufferFullAccessToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_BUFFER_FULL_REFRESH_TOKEN
  if (!refreshToken) throw new Error('GOOGLE_BUFFER_FULL_REFRESH_TOKEN not set')
  if (cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) return cachedToken
  cachedToken = await refreshBufferAccessToken(refreshToken)
  cachedAt = Date.now()
  return cachedToken
}
