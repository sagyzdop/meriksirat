import type { FlamekeeperState } from '@/lib/access/access-rules'
import { isMasterEmail } from '@/lib/flamekeeper/master'

const GB = 1024 * 1024 * 1024

export const DEFAULT_FLAMEKEEPER_CAP_BYTES = 20 * GB
export const FULL_RECOVERY_BYTES = 512 * 1024 * 1024
export const POOL_LOW_FRACTION = 0.1
export const OUT_OF_SPACE_MESSAGE =
  'Out of space, become a flamekeeper / #savenuimg'

export interface PoolFlamekeeper {
  userId: string
  email?: string
  state: FlamekeeperState
  pledgedBytes: number
  usedBytes: number
  reservedBytes: number
  driveUsageBytes: number
}

export type Placement =
  { kind: 'placed'; userId: string } | { kind: 'no_space' }

export interface PoolStats {
  pledgedBytes: number
  usedBytes: number
  freeBytes: number
  flamekeepers: number
}

export function usableBytes(fk: PoolFlamekeeper, capBytes: number): number {
  const pledgeLeft = fk.pledgedBytes - fk.usedBytes - fk.reservedBytes
  const capLeft = capBytes - fk.driveUsageBytes - fk.reservedBytes
  return Math.max(0, Math.min(pledgeLeft, capLeft))
}

export function placeUpload(
  fks: PoolFlamekeeper[],
  opts: {
    bytes: number
    capBytes: number
    exclude?: string[]
    masterEmail?: string | null
  }
): Placement {
  const exclude = new Set(opts.exclude ?? [])
  let best: { userId: string; usable: number } | null = null
  for (const fk of fks) {
    if (fk.state !== 'active' || exclude.has(fk.userId)) continue
    if (isMasterEmail(fk.email, opts.masterEmail)) continue
    const usable = usableBytes(fk, opts.capBytes)
    if (usable < opts.bytes) continue
    if (
      !best ||
      usable > best.usable ||
      (usable === best.usable && fk.userId < best.userId)
    ) {
      best = { userId: fk.userId, usable }
    }
  }
  return best ? { kind: 'placed', userId: best.userId } : { kind: 'no_space' }
}

export function recoverFull(
  fks: PoolFlamekeeper[],
  capBytes: number
): string[] {
  return fks
    .filter(
      (fk) =>
        fk.state === 'full' && usableBytes(fk, capBytes) >= FULL_RECOVERY_BYTES
    )
    .map((fk) => fk.userId)
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

export function isPoolLow(stats: PoolStats): boolean {
  return (
    stats.freeBytes < stats.pledgedBytes * POOL_LOW_FRACTION ||
    stats.pledgedBytes === 0
  )
}

export function poolAlert(
  stats: PoolStats,
  alertedAt: Date | null
): 'alert' | 'rearm' | null {
  const low = isPoolLow(stats)
  if (low && !alertedAt) return 'alert'
  if (!low && alertedAt) return 'rearm'
  return null
}
