import { env } from 'cloudflare:workers'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { resolveSession } from '@/lib/auth/resolve-session'
import { db } from '@/db'
import { UserError } from '@/lib/user-error'

export async function userContext(message = 'Unauthorized') {
  const headers = getRequestHeaders()
  const session = await resolveSession(headers)
  if (!session?.user) throw new UserError(message)
  return {
    session,
    headers,
    database: db(env.meriksirat_d1 as D1Database),
  }
}
