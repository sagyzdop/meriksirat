import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const headers = getRequestHeaders()
    const { auth } = await import('@/lib/auth/auth')
    const session = await auth.api.getSession({
      headers,
    })
    if (!session?.user) return null

    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const database = db(env.meriksirat_d1 as D1Database)
    const row = await database
      .select({ status: user.status })
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()
    if (row?.status === 'Inactive') return null

    return session
  }
)
