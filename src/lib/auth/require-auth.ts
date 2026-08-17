/**
 * Server-only auth helper. This module must never be imported (statically or
 * dynamically) from a module that is bundled for the client: it resolves the
 * current request session via the request headers, which only exist on the
 * server. Call it from inside createServerFn handler bodies, which the TanStack
 * Start transform strips from the client bundle.
 */
export async function requireAuthenticatedUser(): Promise<{ id: string }> {
  const { getRequestHeaders } = await import('@tanstack/react-start/server')
  const headers = getRequestHeaders()
  const { auth } = await import('@/lib/auth/auth')
  const session = await auth.api.getSession({ headers })
  if (!session?.user) {
    throw new Error('Not authenticated')
  }
  return session.user
}
