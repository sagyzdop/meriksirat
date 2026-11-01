import { eq } from 'drizzle-orm'
import type { db } from '@/db'
import { flamekeeperGrant } from '@/db/schema'

type Database = ReturnType<typeof db>

const TOKEN_TTL_MS = 50 * 60 * 1000
const cache = new Map<string, { token: string; at: number }>()

export class FlamekeeperGrantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FlamekeeperGrantError'
  }
}

/**
 * A short-lived `drive.file` access token for one flamekeeper, refreshed from
 * their stored grant. Throws FlamekeeperGrantError when the grant is missing
 * or Google refuses to refresh it.
 */
export async function getFlamekeeperAccessToken(
  database: Database,
  userId: string
): Promise<string> {
  const cached = cache.get(userId)
  if (cached && Date.now() - cached.at < TOKEN_TTL_MS) return cached.token

  const grant = await database
    .select({ refreshToken: flamekeeperGrant.refreshToken })
    .from(flamekeeperGrant)
    .where(eq(flamekeeperGrant.userId, userId))
    .get()
  if (!grant) throw new FlamekeeperGrantError('No Drive grant')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      refresh_token: grant.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    throw new FlamekeeperGrantError(
      `Failed to refresh Drive grant: ${await response.text()}`
    )
  }
  const data = (await response.json()) as { access_token: string }
  cache.set(userId, { token: data.access_token, at: Date.now() })
  return data.access_token
}

export function forgetFlamekeeperAccessToken(userId: string): void {
  cache.delete(userId)
}
