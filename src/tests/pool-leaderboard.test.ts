import { describe, it, expect } from 'vitest'
import {
  ANONYMOUS_NAME,
  buildLeaderboard,
  isOnLeaderboard,
} from '../lib/pool/leaderboard'
import type { LeaderboardRow } from '../lib/pool/leaderboard'

const GB = 1024 ** 3

function row(over: Partial<LeaderboardRow> & { name: string }): LeaderboardRow {
  return {
    image: 'img.png',
    state: 'active',
    pledgedBytes: 10 * GB,
    usedBytes: GB,
    anonymous: false,
    ...over,
  }
}

describe('isOnLeaderboard', () => {
  it('shows active and full only', () => {
    expect(isOnLeaderboard('active')).toBe(true)
    expect(isOnLeaderboard('full')).toBe(true)
    for (const s of ['draining', 'lost', 'drained']) {
      expect(isOnLeaderboard(s)).toBe(false)
    }
  })
})

describe('buildLeaderboard', () => {
  it('ranks by used bytes descending', () => {
    const out = buildLeaderboard([
      row({ name: 'A', usedBytes: 2 * GB }),
      row({ name: 'B', usedBytes: 5 * GB }),
    ])
    expect(out.map((e) => [e.rank, e.name])).toEqual([
      [1, 'B'],
      [2, 'A'],
    ])
  })

  it('drops drained, draining and lost flamekeepers', () => {
    const out = buildLeaderboard([
      row({ name: 'A', state: 'drained', usedBytes: 9 * GB }),
      row({ name: 'B', state: 'draining' }),
      row({ name: 'C', state: 'lost' }),
      row({ name: 'D', state: 'full' }),
    ])
    expect(out.map((e) => e.name)).toEqual(['D'])
  })

  it('hides name and image of anonymous flamekeepers', () => {
    const [e] = buildLeaderboard([row({ name: 'Secret', anonymous: true })])
    expect(e.name).toBe(ANONYMOUS_NAME)
    expect(e.image).toBeNull()
    expect(JSON.stringify(e)).not.toContain('Secret')
  })

  it('gives ties the same rank and breaks order by pledge', () => {
    const out = buildLeaderboard([
      row({ name: 'A', usedBytes: GB, pledgedBytes: 5 * GB }),
      row({ name: 'B', usedBytes: GB, pledgedBytes: 9 * GB }),
      row({ name: 'C', usedBytes: 0 }),
    ])
    expect(out.map((e) => [e.rank, e.name])).toEqual([
      [1, 'B'],
      [1, 'A'],
      [3, 'C'],
    ])
  })
})
