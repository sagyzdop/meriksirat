import type { FlamekeeperState } from '@/lib/access/access-rules'

const GB = 1024 * 1024 * 1024

export const DEFAULT_FLAMEKEEPER_CAP_BYTES = 20 * GB
export const DEFAULT_POOL_LOW_ALERT_PERCENT = 90

export interface PoolFlamekeeper {
  userId: string
  state: FlamekeeperState
  pledgedBytes: number
  usedBytes: number
  driveUsageBytes: number
}

export interface PoolStats {
  pledgedBytes: number
  usedBytes: number
  freeBytes: number
  flamekeepers: number
}

export function usableBytes(fk: PoolFlamekeeper, capBytes: number): number {
  const pledgeLeft = fk.pledgedBytes - fk.usedBytes
  const capLeft = capBytes - fk.driveUsageBytes
  return Math.max(0, Math.min(pledgeLeft, capLeft))
}

export function keepingState(
  fk: PoolFlamekeeper,
  capBytes: number
): 'active' | 'full' {
  return usableBytes(fk, capBytes) > 0 ? 'active' : 'full'
}

export function poolStats(fks: PoolFlamekeeper[], capBytes: number): PoolStats {
  const stats: PoolStats = {
    pledgedBytes: 0,
    usedBytes: 0,
    freeBytes: 0,
    flamekeepers: 0,
  }
  for (const fk of fks) {
    if (fk.state !== 'active' && fk.state !== 'full') continue
    stats.flamekeepers += 1
    stats.pledgedBytes += fk.pledgedBytes
    stats.usedBytes += fk.usedBytes
    if (fk.state === 'active') stats.freeBytes += usableBytes(fk, capBytes)
  }
  return stats
}

export function isPoolLow(
  stats: PoolStats,
  alertPercent: number = DEFAULT_POOL_LOW_ALERT_PERCENT
): boolean {
  if (stats.pledgedBytes === 0) return true
  const usedPercent =
    (100 * (stats.pledgedBytes - stats.freeBytes)) / stats.pledgedBytes
  return usedPercent >= alertPercent
}

export function poolAlert(
  stats: PoolStats,
  alertedAt: Date | null,
  alertPercent: number = DEFAULT_POOL_LOW_ALERT_PERCENT
): 'alert' | 'rearm' | null {
  const low = isPoolLow(stats, alertPercent)
  if (low && !alertedAt) return 'alert'
  if (!low && alertedAt) return 'rearm'
  return null
}
