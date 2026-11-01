import { getTableColumns } from 'drizzle-orm'
import { album as albumTable } from '@/db/schema'
import { describe, it, expect } from 'vitest'
import {
  defaultExpiry,
  expiryBannerDate,
  planExpiry,
  tombstoneCopy,
} from '../lib/pool/expiry'
import type { ExpiryAlbum } from '../lib/pool/expiry'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-06-01T00:00:00Z')
const inDays = (n: number) => new Date(now.getTime() + n * DAY)

function album(id: string, over: Partial<ExpiryAlbum> = {}): ExpiryAlbum {
  return {
    id,
    expiresAt: inDays(100),
    pinned: false,
    deletedAt: null,
    expiryReminder30SentAt: null,
    expiryReminder7SentAt: null,
    ...over,
  }
}

describe('defaultExpiry', () => {
  it('is two years after the event', () => {
    expect(defaultExpiry(new Date('2024-03-10T00:00:00Z')).toISOString()).toBe(
      '2026-03-10T00:00:00.000Z'
    )
  })
})

describe('planExpiry', () => {
  it('expires albums at or past their expiry', () => {
    const plan = planExpiry(
      [
        album('a', { expiresAt: inDays(-1) }),
        album('b', { expiresAt: now }),
        album('c', { expiresAt: inDays(1) }),
      ],
      now
    )
    expect(plan.expire).toEqual(['a', 'b'])
  })

  it('never expires or reminds pinned, deleted or undated albums', () => {
    const plan = planExpiry(
      [
        album('p', { pinned: true, expiresAt: inDays(-5) }),
        album('d', { deletedAt: inDays(-1), expiresAt: inDays(-5) }),
        album('n', { expiresAt: null }),
      ],
      now
    )
    expect(plan).toEqual({ expire: [], remind30: [], remind7: [] })
  })

  it('sends the 30-day reminder inside 30 days, once', () => {
    const due = album('a', { expiresAt: inDays(29) })
    const sent = album('b', {
      expiresAt: inDays(29),
      expiryReminder30SentAt: inDays(-1),
    })
    const far = album('c', { expiresAt: inDays(31) })
    const plan = planExpiry([due, sent, far], now)
    expect(plan.remind30).toEqual(['a'])
    expect(plan.remind7).toEqual([])
  })

  it('sends the 7-day reminder inside 7 days, once', () => {
    const due = album('a', {
      expiresAt: inDays(6),
      expiryReminder30SentAt: inDays(-20),
    })
    const sent = album('b', {
      expiresAt: inDays(6),
      expiryReminder7SentAt: inDays(-1),
    })
    const plan = planExpiry([due, sent], now)
    expect(plan.remind7).toEqual(['a'])
    expect(plan.remind30).toEqual([])
  })

  it('skips the 30-day reminder when only 7 days remain', () => {
    const plan = planExpiry([album('a', { expiresAt: inDays(3) })], now)
    expect(plan.remind30).toEqual([])
    expect(plan.remind7).toEqual(['a'])
  })

  it('treats a migrated album (now + 30 days) as due for the 30-day reminder', () => {
    const plan = planExpiry([album('a', { expiresAt: inDays(30) })], now)
    expect(plan.remind30).toEqual(['a'])
  })
})

describe('expiryBannerDate', () => {
  it('shows only in the last 30 days', () => {
    expect(
      expiryBannerDate(album('a', { expiresAt: inDays(30) }), now)
    ).toEqual(inDays(30))
    expect(expiryBannerDate(album('a', { expiresAt: inDays(31) }), now)).toBe(
      null
    )
  })

  it('hides for pinned albums', () => {
    expect(
      expiryBannerDate(album('a', { expiresAt: inDays(5), pinned: true }), now)
    ).toBe(null)
  })
})

describe('tombstoneCopy', () => {
  it('has distinct copy per reason', () => {
    const reasons = [
      'expired',
      'flamekeeper_left',
      'flamekeeper_lost',
      'no_space',
    ] as const
    const copies = new Set(reasons.map((r) => tombstoneCopy(r).description))
    expect(copies.size).toBe(4)
  })

  it('covers every reason in the schema with its own copy', () => {
    const fallback = tombstoneCopy(null).description
    for (const reason of getTableColumns(albumTable).tombstoneReason
      .enumValues) {
      const copy = tombstoneCopy(reason)
      expect(copy.title.length).toBeGreaterThan(0)
      expect(copy.description.length).toBeGreaterThan(0)
      if (reason !== 'expired') {
        expect(copy.description).not.toBe(fallback)
      }
    }
    expect(tombstoneCopy('expired').description).toBe(fallback)
  })
})
