import { describe, it, expect } from 'vitest'
import {
  clubCodeMatches,
  getAccessRules,
  type AccessUser,
} from '../lib/access/access-rules'
import { generateClubCode } from '../lib/access/club-code'

const base: AccessUser = {
  isMember: false,
  role: 'user',
  email: 'jane@gmail.com',
  flamekeeperState: null,
}

describe('getAccessRules', () => {
  it('lets a plain member use every member feature', () => {
    const rules = getAccessRules({ ...base, isMember: true })
    expect(rules.canBook).toBe(true)
    expect(rules.canCreateAlbum).toBe(true)
    expect(rules.canFavorite).toBe(true)
    expect(rules.canHoldStaffRole).toBe(true)
    expect(rules.canDeleteAccount).toBe(false)
    expect(rules.onboardingPath).toBe('member')
  })

  it('blocks a user who is neither member nor flamekeeper', () => {
    const rules = getAccessRules(base)
    expect(rules.canBook).toBe(false)
    expect(rules.canCreateAlbum).toBe(false)
    expect(rules.canFavorite).toBe(false)
    expect(rules.canHoldStaffRole).toBe(false)
    expect(rules.canDeleteAccount).toBe(false)
    expect(rules.onboardingPath).toBe('choose')
  })

  it('keeps an active flamekeeper-only user out of member features', () => {
    const rules = getAccessRules({
      ...base,
      email: 'jane@nu.edu.kz',
      flamekeeperState: 'active',
    })
    expect(rules.canBook).toBe(false)
    expect(rules.canCreateAlbum).toBe(false)
    expect(rules.canFavorite).toBe(true)
    expect(rules.canBecomeFlamekeeper).toBe(false)
    expect(rules.canDeleteAccount).toBe(false)
    expect(rules.onboardingPath).toBe('flamekeeper')
  })

  it('lets a drained flamekeeper-only user delete their account', () => {
    const rules = getAccessRules({
      ...base,
      email: 'jane@nu.edu.kz',
      flamekeeperState: 'drained',
    })
    expect(rules.canDeleteAccount).toBe(true)
    expect(rules.canBecomeFlamekeeper).toBe(true)
  })

  it('never lets a member delete their account', () => {
    const rules = getAccessRules({
      ...base,
      isMember: true,
      email: 'jane@nu.edu.kz',
      flamekeeperState: 'drained',
    })
    expect(rules.canDeleteAccount).toBe(false)
    expect(rules.onboardingPath).toBe('member')
  })

  it('allows only @nu.edu.kz emails to become flamekeepers', () => {
    expect(
      getAccessRules({ ...base, email: 'a@nu.edu.kz' }).canBecomeFlamekeeper
    ).toBe(true)
    expect(
      getAccessRules({ ...base, email: 'A@NU.EDU.KZ' }).canBecomeFlamekeeper
    ).toBe(true)
    expect(
      getAccessRules({ ...base, email: 'a@alumni.nu.edu.kz' })
        .canBecomeFlamekeeper
    ).toBe(false)
    expect(
      getAccessRules({ ...base, email: 'a@gmail.com' }).canBecomeFlamekeeper
    ).toBe(false)
  })

  it('does not let an admin who is not a member hold a staff role', () => {
    expect(getAccessRules({ ...base, role: 'admin' }).canHoldStaffRole).toBe(
      false
    )
    expect(
      getAccessRules({ ...base, role: 'admin', isMember: true }).canBook
    ).toBe(true)
  })
})

describe('clubCodeMatches', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(clubCodeMatches('  k7qm-4txd ', 'K7QM-4TXD')).toBe(true)
  })

  it('rejects a wrong code', () => {
    expect(clubCodeMatches('K7QM-4TXE', 'K7QM-4TXD')).toBe(false)
  })

  it('rejects everything when no code is set', () => {
    expect(clubCodeMatches('', '')).toBe(false)
    expect(clubCodeMatches('anything', null)).toBe(false)
    expect(clubCodeMatches('anything', undefined)).toBe(false)
  })
})

describe('generateClubCode', () => {
  it('produces a grouped, matchable code', () => {
    const code = generateClubCode()
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(clubCodeMatches(code.toLowerCase(), code)).toBe(true)
  })
})
