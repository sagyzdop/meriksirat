import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import type { PoolStats } from '@/lib/pool/placement'

export interface PoolOverview extends PoolStats {
  capBytes: number
}

export const getPoolOverviewFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PoolOverview> => {
    const { checkAdminPermission } = await import('../server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { loadCapBytes, loadPoolFlamekeepers } =
      await import('@/lib/pool/server')
    const { poolStats } = await import('@/lib/pool/placement')

    await checkAdminPermission(getRequestHeaders(), ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)
    const [fks, capBytes] = await Promise.all([
      loadPoolFlamekeepers(database),
      loadCapBytes(database),
    ])
    return { ...poolStats(fks, capBytes), capBytes }
  }
)

export const setFlamekeeperCapFn = createServerFn({ method: 'POST' })
  .validator(z.object({ capGb: z.number().min(1).max(1024) }))
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('../server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { settings } = await import('@/db/schema')
    const { gbToBytes } = await import('@/lib/flamekeeper/rules')

    await checkAdminPermission(getRequestHeaders(), ['admin'])

    const flamekeeperCapBytes = gbToBytes(data.capGb)
    await db(env.meriksirat_d1 as D1Database)
      .insert(settings)
      .values({ id: 'global', flamekeeperCapBytes })
      .onConflictDoUpdate({
        target: settings.id,
        set: { flamekeeperCapBytes, updatedAt: new Date() },
      })
    return { success: true }
  })
