import { describe, expect, it } from 'vitest'
import {
  FULL_RECOVERY_BYTES,
  placeUpload,
  poolAlert,
  poolStats,
  recoverFull,
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
    reservedBytes: 0,
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

  it('subtracts in-flight reservations from both terms', () => {
    expect(
      usableBytes(fk({ usedBytes: 2 * GB, reservedBytes: 1 * GB }), CAP)
    ).toBe(7 * GB)
    expect(
      usableBytes(
        fk({
          pledgedBytes: 15 * GB,
          driveUsageBytes: 18 * GB,
          reservedBytes: GB,
        }),
        CAP
      )
    ).toBe(1 * GB)
  })

  it('never goes negative', () => {
    expect(usableBytes(fk({ usedBytes: 12 * GB }), CAP)).toBe(0)
    expect(usableBytes(fk({ driveUsageBytes: 25 * GB }), CAP)).toBe(0)
  })
})

describe('placeUpload', () => {
  it('picks the active flamekeeper with the most usable space', () => {
    const result = placeUpload(
      [
        fk({ userId: 'a', usedBytes: 8 * GB }),
        fk({ userId: 'b', usedBytes: 1 * GB }),
        fk({ userId: 'c', usedBytes: 5 * GB }),
      ],
      { bytes: GB, capBytes: CAP }
    )
    expect(result).toEqual({ kind: 'placed', userId: 'b' })
  })

  it('never places past a pledge', () => {
    const result = placeUpload(
      [fk({ userId: 'a', pledgedBytes: 2 * GB, usedBytes: 2 * GB - 10 })],
      { bytes: 11, capBytes: CAP }
    )
    expect(result).toEqual({ kind: 'no_space' })
  })

  it('accepts an upload that exactly fills a pledge', () => {
    const result = placeUpload(
      [fk({ userId: 'a', pledgedBytes: 2 * GB, usedBytes: 2 * GB - 10 })],
      { bytes: 10, capBytes: CAP }
    )
    expect(result).toEqual({ kind: 'placed', userId: 'a' })
  })

  it('respects the cap term over a larger pledge', () => {
    const result = placeUpload(
      [
        fk({ userId: 'big', pledgedBytes: 20 * GB, driveUsageBytes: 19 * GB }),
        fk({ userId: 'small', pledgedBytes: 3 * GB }),
      ],
      { bytes: GB, capBytes: CAP }
    )
    expect(result).toEqual({ kind: 'placed', userId: 'small' })
  })

  it('follows the cap setting', () => {
    const fks = [fk({ userId: 'a', driveUsageBytes: 9 * GB })]
    expect(placeUpload(fks, { bytes: 2 * GB, capBytes: 10 * GB })).toEqual({
      kind: 'no_space',
    })
    expect(placeUpload(fks, { bytes: 2 * GB, capBytes: CAP })).toEqual({
      kind: 'placed',
      userId: 'a',
    })
  })

  it('skips flamekeepers that are not active', () => {
    const result = placeUpload(
      [
        fk({ userId: 'full', state: 'full' }),
        fk({ userId: 'draining', state: 'draining' }),
        fk({ userId: 'lost', state: 'lost' }),
        fk({ userId: 'drained', state: 'drained' }),
      ],
      { bytes: 1, capBytes: CAP }
    )
    expect(result).toEqual({ kind: 'no_space' })
  })

  it('skips excluded flamekeepers so a retry goes elsewhere', () => {
    const result = placeUpload(
      [fk({ userId: 'a' }), fk({ userId: 'b', usedBytes: 5 * GB })],
      { bytes: GB, capBytes: CAP, exclude: ['a'] }
    )
    expect(result).toEqual({ kind: 'placed', userId: 'b' })
  })

  it('reports no space when nobody can take the upload', () => {
    expect(placeUpload([], { bytes: 1, capBytes: CAP })).toEqual({
      kind: 'no_space',
    })
  })

  it('breaks ties deterministically', () => {
    const result = placeUpload([fk({ userId: 'b' }), fk({ userId: 'a' })], {
      bytes: 1,
      capBytes: CAP,
    })
    expect(result).toEqual({ kind: 'placed', userId: 'a' })
  })
})

describe('recoverFull', () => {
  it('returns full flamekeepers to active once space frees', () => {
    expect(
      recoverFull(
        [
          fk({ userId: 'freed', state: 'full', driveUsageBytes: 5 * GB }),
          fk({
            userId: 'still',
            state: 'full',
            driveUsageBytes: CAP - FULL_RECOVERY_BYTES + 1,
          }),
          fk({ userId: 'active', state: 'active' }),
        ],
        CAP
      )
    ).toEqual(['freed'])
  })

  it('keeps a full flamekeeper full while their pledge is used up', () => {
    expect(
      recoverFull([fk({ state: 'full', usedBytes: 10 * GB })], CAP)
    ).toEqual([])
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
  const healthy = {
    pledgedBytes: 100 * GB,
    usedBytes: 50 * GB,
    freeBytes: 50 * GB,
    flamekeepers: 3,
  }
  const low = { ...healthy, usedBytes: 91 * GB, freeBytes: 9 * GB }

  it('alerts once when free space drops below 10%', () => {
    expect(poolAlert(low, null)).toBe('alert')
    expect(poolAlert(low, new Date())).toBeNull()
  })

  it('re-arms when free space recovers', () => {
    expect(poolAlert(healthy, new Date())).toBe('rearm')
    expect(poolAlert(healthy, null)).toBeNull()
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
