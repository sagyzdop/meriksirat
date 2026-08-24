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

    return session
  }
)
