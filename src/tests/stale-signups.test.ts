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
    email: `${id}@nu.edu.kz`,
    isMember: false,
    hasFlamekeeperRecord: false,
    hasDriveGrant: false,
    createdAt: daysAgo(10),
    ownsAnything: false,
    bannedAt: null,
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

  it('never selects a banned user', () => {
    expect(
      selectStaleSignups(
        [u('banned', { bannedAt: daysAgo(9) }), u('plain')],
        now
      )
    ).toEqual(['plain'])
  })

  it('banned users do not take batch slots', () => {
    const banned = Array.from({ length: 5 }, (_, i) =>
      u(`b${i}`, { bannedAt: daysAgo(20), createdAt: daysAgo(30) })
    )
    expect(selectStaleSignups([...banned, u('x')], now, 2)).toEqual(['x'])
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

  it('keeps alumni accounts even when idle', () => {
    expect(
      selectStaleSignups([u('a', { email: 'x@alumni.nu.edu.kz' })], now)
    ).toEqual([])
    expect(
      selectStaleSignups([u('b', { email: 'X@Alumni.NU.edu.kz' })], now)
    ).toEqual([])
  })

  it('still removes idle nu.edu.kz, legacy and lookalike accounts', () => {
    expect(
      selectStaleSignups(
        [
          u('nu', { email: 'x@nu.edu.kz' }),
          u('gmail', { email: 'x@gmail.com' }),
          u('fake', { email: 'x@evil.alumni.nu.edu.kz' }),
        ],
        now
      ).sort()
    ).toEqual(['fake', 'gmail', 'nu'])
  })

  it('does not let alumni fill the batch', () => {
    const alumni = Array.from({ length: 30 }, (_, i) =>
      u(`al${i}`, { email: `a${i}@alumni.nu.edu.kz`, createdAt: daysAgo(100) })
    )
    expect(selectStaleSignups([...alumni, u('nu')], now)).toEqual(['nu'])
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
