import { describe, expect, it } from 'vitest'
import {
  poolAlert,
  poolStats,
  usableBytes,
  type PoolFlamekeeper,
} from '@/lib/pool/placement'

const GB = 1024 * 1024 * 1024
const CAP = 20 * GB

function fk(overrides: Partial<PoolFlamekeeper> = {}): PoolFlamekeeper {
  return {
    userId: 'a',
    state: 'active',
    pledgedBytes: 10 * GB,
    usedBytes: 0,
    driveUsageBytes: 0,
    ...overrides,
  }
}

describe('usableBytes', () => {
  it('is the pledge left when the cap is far away', () => {
    expect(usableBytes(fk({ usedBytes: 4 * GB }), CAP)).toBe(6 * GB)
  })

  it('is limited by the cap minus Drive usage', () => {
    expect(
      usableBytes(fk({ pledgedBytes: 15 * GB, driveUsageBytes: 18 * GB }), CAP)
    ).toBe(2 * GB)
  })

  it('never goes negative', () => {
    expect(usableBytes(fk({ usedBytes: 12 * GB }), CAP)).toBe(0)
    expect(usableBytes(fk({ driveUsageBytes: 25 * GB }), CAP)).toBe(0)
  })
})

describe('poolStats', () => {
  it('sums active and full flamekeepers; only active ones add free space', () => {
    const stats = poolStats(
      [
        fk({ userId: 'a', pledgedBytes: 10 * GB, usedBytes: 4 * GB }),
        fk({
          userId: 'b',
          state: 'full',
          pledgedBytes: 5 * GB,
          usedBytes: 2 * GB,
        }),
        fk({ userId: 'c', state: 'draining', pledgedBytes: 7 * GB }),
      ],
      CAP
    )
    expect(stats).toEqual({
      pledgedBytes: 15 * GB,
      usedBytes: 6 * GB,
      freeBytes: 6 * GB,
      flamekeepers: 2,
    })
  })
})

describe('poolAlert', () => {
  const mid = {
    pledgedBytes: 100 * GB,
    usedBytes: 80 * GB,
    freeBytes: 20 * GB,
    flamekeepers: 3,
  }

  const healthy = {
    pledgedBytes: 100 * GB,
    usedBytes: 50 * GB,
    freeBytes: 50 * GB,
    flamekeepers: 3,
  }
  const low = { ...healthy, usedBytes: 91 * GB, freeBytes: 9 * GB }

  it('alerts once when used space reaches 90%', () => {
    expect(poolAlert(low, null)).toBe('alert')
    expect(poolAlert(low, new Date())).toBeNull()
  })

  it('re-arms when used space falls back below 90%', () => {
    expect(poolAlert(healthy, new Date())).toBe('rearm')
    expect(poolAlert(healthy, null)).toBeNull()
  })

  it('uses the configured threshold', () => {
    expect(poolAlert(mid, null)).toBeNull()
    expect(poolAlert(mid, null, 80)).toBe('alert')
  })

  it('treats an empty pool as low', () => {
    expect(
      poolAlert(
        { pledgedBytes: 0, usedBytes: 0, freeBytes: 0, flamekeepers: 0 },
        null
      )
    ).toBe('alert')
  })
})
