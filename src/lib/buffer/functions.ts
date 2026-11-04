import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { BufferLevel } from './usage'

export interface BufferUsageOverview {
  usedBytes: number
  limitBytes: number | null
  percent: number | null
  level: BufferLevel
  checkedAt: number
}

const DASHBOARD_MAX_AGE_MS = 10 * 60 * 1000

export const getBufferUsageFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BufferUsageOverview | null> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { getBufferUsage } = await import('./usage-server')
    const { bufferUsageLevel, usagePercent } = await import('./usage')

    await adminContext(['admin', 'manager'])

    const usage = await getBufferUsage(DASHBOARD_MAX_AGE_MS)
    if (!usage) return null
    return {
      ...usage,
      percent: usagePercent(usage),
      level: bufferUsageLevel(usage),
    }
  }
)

export const getBufferBannerFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => {
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const { readBufferUsage } = await import('./usage-server')
    const { bufferBannerVisible, bufferUsageLevel } = await import('./usage')

    const session = await resolveSession(getRequestHeaders())
    if (!session?.user) return false

    const usage = await readBufferUsage()
    if (!usage) return false
    return bufferBannerVisible(session.user.email, bufferUsageLevel(usage))
  }
)
