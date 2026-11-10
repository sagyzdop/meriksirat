import { and, eq, like, lt } from 'drizzle-orm'
import type { Database } from '@/db'
import { verification } from '@/db/schema'

const PREFIX = 'oauth-state:'
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

export type OAuthFlow = 'flamekeeper' | 'buffer'

function identifier(flow: OAuthFlow, nonce: string) {
  return `${PREFIX}${flow}:${nonce}`
}

export function isOAuthStateLive(expiresAt: Date, now: Date) {
  return expiresAt.getTime() > now.getTime()
}

export async function saveOAuthState(
  database: Database,
  flow: OAuthFlow,
  value: unknown
): Promise<string> {
  const now = new Date()
  const nonce = crypto.randomUUID()
  await database.batch([
    database
      .delete(verification)
      .where(
        and(
          like(verification.identifier, `${PREFIX}%`),
          lt(verification.expiresAt, now)
        )
      ),
    database.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: identifier(flow, nonce),
      value: JSON.stringify(value),
      expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
    }),
  ])
  return nonce
}

export async function takeOAuthState<T>(
  database: Database,
  flow: OAuthFlow,
  nonce: string
): Promise<T | null> {
  const [row] = await database
    .delete(verification)
    .where(eq(verification.identifier, identifier(flow, nonce)))
    .returning({
      value: verification.value,
      expiresAt: verification.expiresAt,
    })
  if (!row || !isOAuthStateLive(row.expiresAt, new Date())) return null
  return JSON.parse(row.value) as T
}
