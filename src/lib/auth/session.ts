import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const headers = getRequestHeaders()
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const session = await resolveSession(headers)
    if (!session?.user) return null

    return session
  }
)
