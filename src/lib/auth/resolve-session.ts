/**
 * Request-scoped memoization for better-auth session resolution.
 *
 * `getRequestHeaders()` returns the same Headers instance for every call
 * within a single request (it is stored on the h3 event via AsyncLocalStorage),
 * so keying on that instance dedupes all `auth.api.getSession` calls made while
 * serving one request, without ever leaking across requests (each new request
 * gets a fresh Headers object; old entries are garbage-collected).
 */
const sessionCache = new WeakMap<
  Headers,
  Promise<Awaited<ReturnType<typeof resolveSessionUncached>>>
>()

async function resolveSessionUncached(headers: Headers) {
  const { auth } = await import('@/lib/auth/auth')
  const result = await auth.api.getSession({ headers })
  if (!result?.user) return result
  const { env } = await import('cloudflare:workers')
  const { db } = await import('@/db')
  const { user, session } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')
  const database = db(env.meriksirat_d1 as D1Database)
  const row = await database
    .select({ bannedAt: user.bannedAt, status: user.status })
    .from(user)
    .where(eq(user.id, result.user.id))
    .get()
  if (row && !row.bannedAt && row.status !== 'Inactive') return result
  await database.delete(session).where(eq(session.userId, result.user.id))
  return null
}

export function resolveSession(headers: Headers) {
  let cached = sessionCache.get(headers)
  if (!cached) {
    cached = resolveSessionUncached(headers).catch((error) => {
      sessionCache.delete(headers)
      throw error
    })
    sessionCache.set(headers, cached)
  }
  return cached
}
