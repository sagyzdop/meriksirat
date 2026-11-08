import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { PoolStats } from '@/lib/pool/placement'

export interface PoolOverview extends PoolStats {
  capBytes: number
  alertPercent: number
}

export const getPoolOverviewFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PoolOverview> => {
    const { adminContext } = await import('../server')
    const { loadCapBytes, loadPoolFlamekeepers, loadPoolLowAlertPercent } =
      await import('@/lib/pool/server')
    const { poolStats } = await import('@/lib/pool/placement')

    const { database } = await adminContext(['admin', 'manager'])

    const [fks, capBytes, alertPercent] = await Promise.all([
      loadPoolFlamekeepers(database),
      loadCapBytes(database),
      loadPoolLowAlertPercent(database),
    ])
    return { ...poolStats(fks, capBytes), capBytes, alertPercent }
  }
)

export const setFlamekeeperCapFn = createServerFn({ method: 'POST' })
  .validator(z.object({ capGb: z.number().min(1).max(1024) }))
  .handler(async ({ data }) => {
    const { adminContext } = await import('../server')
    const { settings } = await import('@/db/schema')
    const { gbToBytes } = await import('@/lib/flamekeeper/rules')

    const { database } = await adminContext(['admin'])

    const flamekeeperCapBytes = gbToBytes(data.capGb)
    await database
      .insert(settings)
      .values({ id: 'global', flamekeeperCapBytes })
      .onConflictDoUpdate({
        target: settings.id,
        set: { flamekeeperCapBytes, updatedAt: new Date() },
      })
    return { success: true }
  })
