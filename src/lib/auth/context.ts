import { env } from 'cloudflare:workers'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { resolveSession } from '@/lib/auth/resolve-session'
import { db } from '@/db'

export async function userContext(message = 'Unauthorized') {
  const headers = getRequestHeaders()
  const session = await resolveSession(headers)
  if (!session?.user) throw new Error(message)
  return {
    session,
    headers,
    database: db(env.meriksirat_d1 as D1Database),
  }
}
