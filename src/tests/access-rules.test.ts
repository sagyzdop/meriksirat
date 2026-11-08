import { describe, it, expect } from 'vitest'
import {
  clubCodeMatches,
  getAccessRules,
  homePath,
  needsOnboarding,
  nonMemberCanVisit,
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
  })

  it('gives a plain account favorites but no member features', () => {
    const rules = getAccessRules({ ...base, email: 'jane@alumni.nu.edu.kz' })
    expect(rules.canBook).toBe(false)
    expect(rules.canCreateAlbum).toBe(false)
    expect(rules.canFavorite).toBe(true)
    expect(rules.canHoldStaffRole).toBe(false)
    expect(rules.canBecomeFlamekeeper).toBe(false)
    expect(rules.canDeleteAccount).toBe(true)
  })

  it('stops a non-member deleting while still flamekeeping', () => {
    for (const state of ['active', 'full', 'draining', 'lost'] as const) {
      expect(
        getAccessRules({
          ...base,
          email: 'j@nu.edu.kz',
          flamekeeperState: state,
        }).canDeleteAccount
      ).toBe(false)
    }
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

describe('getAccessRules across flamekeeper states', () => {
  const nu: AccessUser = { ...base, email: 'jane@nu.edu.kz' }
  const states = ['active', 'full', 'draining', 'lost'] as const

  it.each(states)(
    'keeps a %s flamekeeper-only user out of member features',
    (state) => {
      const rules = getAccessRules({ ...nu, flamekeeperState: state })
      expect(rules.canBook).toBe(false)
      expect(rules.canCreateAlbum).toBe(false)
      expect(rules.canHoldStaffRole).toBe(false)
      expect(rules.canFavorite).toBe(true)
      expect(rules.canBecomeFlamekeeper).toBe(false)
      expect(rules.canDeleteAccount).toBe(false)
    }
  )

  it.each(states)(
    'gives a member who is %s flamekeeping every member feature',
    (state) => {
      const rules = getAccessRules({
        ...nu,
        isMember: true,
        flamekeeperState: state,
      })
      expect(rules.canBook).toBe(true)
      expect(rules.canBecomeFlamekeeper).toBe(false)
      expect(rules.canDeleteAccount).toBe(false)
    }
  )

  it('lets a drained member sign up as a flamekeeper again', () => {
    const rules = getAccessRules({
      ...nu,
      isMember: true,
      flamekeeperState: 'drained',
    })
    expect(rules.canBecomeFlamekeeper).toBe(true)
  })

  it('never offers flamekeeping to a non-NU member', () => {
    const rules = getAccessRules({ ...base, isMember: true })
    expect(rules.canBecomeFlamekeeper).toBe(false)
  })
})

describe('entry rules', () => {
  const nonMember = { isMember: false }

  it('never sends a non-member to onboarding, whatever their history', () => {
    expect(needsOnboarding(nonMember)).toBe(false)
    expect(homePath(nonMember)).toBe('/account')
    expect(needsOnboarding({ ...nonMember, flamekeeperState: 'active' })).toBe(
      false
    )
    expect(needsOnboarding({ ...nonMember, termsAcceptedAt: new Date() })).toBe(
      false
    )
  })

  it('sends a member to the profile step until onboarding is complete', () => {
    expect(needsOnboarding({ isMember: true, onboardingComplete: false })).toBe(
      true
    )
    expect(needsOnboarding({ isMember: true, onboardingComplete: null })).toBe(
      true
    )
    expect(homePath({ isMember: true, onboardingComplete: true })).toBe(
      '/equipment'
    )
  })

  it('runs the member steps for a non-member who just entered the code', () => {
    expect(
      needsOnboarding({
        isMember: true,
        onboardingComplete: false,
        flamekeeperState: 'active',
        termsAcceptedAt: new Date(),
      })
    ).toBe(true)
  })

  it('limits non-members to their profile and favorites', () => {
    expect(nonMemberCanVisit('/account')).toBe(true)
    expect(nonMemberCanVisit('/account/')).toBe(true)
    expect(nonMemberCanVisit('/favorites')).toBe(true)
    expect(nonMemberCanVisit('/equipment')).toBe(false)
    expect(nonMemberCanVisit('/accountX')).toBe(false)
    expect(nonMemberCanVisit('/my-albums')).toBe(false)
    expect(nonMemberCanVisit('/admin/members')).toBe(false)
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
