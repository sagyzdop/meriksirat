import { describe, expect, it } from 'vitest'
import {
  STALE_SIGNUP_MAX_DELETES,
  selectStaleSignups,
} from '@/lib/auth/stale-signups'
import type { SignupCandidate } from '@/lib/auth/stale-signups'

const now = new Date('2026-11-01T00:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)

function u(id: string, over: Partial<SignupCandidate> = {}): SignupCandidate {
  return {
    id,
    isMember: false,
    hasFlamekeeperRecord: false,
    hasDriveGrant: false,
    createdAt: daysAgo(10),
    ownsAnything: false,
    ...over,
  }
}

describe('selectStaleSignups', () => {
  it('selects non-members at least 7 days old', () => {
    expect(
      selectStaleSignups(
        [
          u('old'),
          u('exact', { createdAt: daysAgo(7) }),
          u('new', { createdAt: daysAgo(6) }),
        ],
        now
      ).sort()
    ).toEqual(['exact', 'old'])
  })

  it('skips members and users who own anything', () => {
    expect(
      selectStaleSignups(
        [u('m', { isMember: true }), u('o', { ownsAnything: true })],
        now
      )
    ).toEqual([])
  })

  it('skips anyone with a flamekeeper record or a Drive grant', () => {
    expect(
      selectStaleSignups(
        [
          u('f', { hasFlamekeeperRecord: true }),
          u('g', { hasDriveGrant: true }),
        ],
        now
      )
    ).toEqual([])
  })

  it('removes an alumni who did nothing, like any other idle account', () => {
    expect(selectStaleSignups([u('alumni')], now)).toEqual(['alumni'])
  })

  it('caps and takes oldest first', () => {
    const users = Array.from({ length: 30 }, (_, i) =>
      u(`u${i}`, { createdAt: daysAgo(8 + i) })
    )
    const ids = selectStaleSignups(users, now)
    expect(ids).toHaveLength(STALE_SIGNUP_MAX_DELETES)
    expect(ids[0]).toBe('u29')
    expect(selectStaleSignups(users, now, 3)).toHaveLength(3)
  })
})
