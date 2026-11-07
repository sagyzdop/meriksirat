import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { BufferOverview } from './usage'

export type BufferUsageOverview = BufferOverview & { checkedAt: number }

const DASHBOARD_MAX_AGE_MS = 10 * 60 * 1000

export const getBufferUsageFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BufferUsageOverview | null> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { getBufferOverview } = await import('./usage-server')

    await adminContext(['admin', 'manager'])

    return getBufferOverview(DASHBOARD_MAX_AGE_MS)
  }
)

export const getBufferBannerFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => {
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const { readBufferUsage, toBufferOverview } = await import('./usage-server')
    const { bufferBannerVisible } = await import('./usage')

    const session = await resolveSession(getRequestHeaders())
    if (!session?.user) return false

    const usage = await readBufferUsage()
    if (!usage) return false
    const overview = await toBufferOverview(usage)
    return bufferBannerVisible(session.user.email, overview.level)
  }
)
