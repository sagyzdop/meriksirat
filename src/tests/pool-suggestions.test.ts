import { describe, it, expect } from 'vitest'
import {
  canExpireEarly,
  earlyExpiryDate,
  planEarlyExpiryNotices,
  suggestDeletions,
} from '../lib/pool/suggestions'
import type { SuggestionAlbum } from '../lib/pool/suggestions'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-06-01T00:00:00Z')
const inDays = (n: number) => new Date(now.getTime() + n * DAY)

function album(
  over: Partial<SuggestionAlbum> & { id: string }
): SuggestionAlbum {
  return {
    expiresAt: inDays(100),
    pinned: false,
    deletedAt: null,
    favoriteCount: 0,
    photoBytes: 1000,
    ...over,
  }
}

const ids = (list: SuggestionAlbum[]) => list.map((a) => a.id)

describe('suggestDeletions', () => {
  it('excludes pinned and deleted albums', () => {
    const out = suggestDeletions([
      album({ id: 'a' }),
      album({ id: 'b', pinned: true }),
      album({ id: 'c', deletedAt: now }),
    ])
    expect(ids(out)).toEqual(['a'])
  })

  it('puts unfavorited albums before favorited ones', () => {
    const out = suggestDeletions([
      album({ id: 'fav', favoriteCount: 3, expiresAt: inDays(1) }),
      album({ id: 'plain', expiresAt: inDays(500) }),
    ])
    expect(ids(out)).toEqual(['plain', 'fav'])
  })

  it('orders each group by soonest expiry then largest size', () => {
    const out = suggestDeletions([
      album({ id: 'late', expiresAt: inDays(50) }),
      album({ id: 'small', expiresAt: inDays(10), photoBytes: 10 }),
      album({ id: 'big', expiresAt: inDays(10), photoBytes: 999 }),
      album({ id: 'favSoon', favoriteCount: 1, expiresAt: inDays(5) }),
      album({ id: 'favLate', favoriteCount: 2, expiresAt: inDays(60) }),
    ])
    expect(ids(out)).toEqual(['big', 'small', 'late', 'favSoon', 'favLate'])
  })

  it('does not mutate the input', () => {
    const input = [album({ id: 'x', expiresAt: inDays(9) }), album({ id: 'y' })]
    suggestDeletions(input)
    expect(ids(input)).toEqual(['x', 'y'])
  })
})

describe('earlyExpiry', () => {
  it('is seven days out', () => {
    expect(earlyExpiryDate(now).getTime()).toBe(inDays(7).getTime())
  })

  it('refuses pinned, deleted, or already sooner albums', () => {
    expect(canExpireEarly(album({ id: 'a' }), now)).toBe(true)
    expect(canExpireEarly(album({ id: 'a', pinned: true }), now)).toBe(false)
    expect(canExpireEarly(album({ id: 'a', deletedAt: now }), now)).toBe(false)
    expect(canExpireEarly(album({ id: 'a', expiresAt: inDays(3) }), now)).toBe(
      false
    )
  })
})

describe('planEarlyExpiryNotices', () => {
  const u = (id: string, chat: string | null = null) => ({
    id,
    email: `${id}@nu.edu.kz`,
    telegramChatId: chat,
  })

  it('notifies owner first and each favoriter once', () => {
    const out = planEarlyExpiryNotices('o', [
      u('f1', 'c1'),
      u('o'),
      u('f1', 'c1'),
      u('f2'),
    ])
    expect(out.map((r) => [r.id, r.role, r.channel])).toEqual([
      ['o', 'owner', 'email'],
      ['f1', 'favoriter', 'telegram'],
      ['f2', 'favoriter', 'email'],
    ])
  })

  it('treats an owner who favorited as owner only', () => {
    const out = planEarlyExpiryNotices('o', [u('o', 'c'), u('o', 'c')])
    expect(out).toHaveLength(1)
    expect(out[0].role).toBe('owner')
  })

  it('returns nothing without users', () => {
    expect(planEarlyExpiryNotices('o', [])).toEqual([])
  })
})
