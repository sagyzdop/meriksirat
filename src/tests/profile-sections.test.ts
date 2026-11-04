import { describe, it, expect } from 'vitest'
import { getAccessRules, type AccessUser } from '../lib/access/access-rules'

const base: AccessUser = {
  isMember: false,
  role: 'user',
  email: 'jane@nu.edu.kz',
  flamekeeperState: null,
}

describe('profile sections', () => {
  it('shows a member every section and no join action', () => {
    const rules = getAccessRules({ ...base, isMember: true })
    expect(rules.showAboutYou).toBe(true)
    expect(rules.showContact).toBe(true)
    expect(rules.canJoinClub).toBe(false)
    expect(rules.graduationUnderFlamekeeper).toBe(false)
  })

  it('shows a member who is flamekeeping graduation under About you', () => {
    const rules = getAccessRules({
      ...base,
      isMember: true,
      flamekeeperState: 'active',
    })
    expect(rules.showFlamekeeperSection).toBe(true)
    expect(rules.graduationUnderFlamekeeper).toBe(false)
  })

  it.each(['active', 'full', 'draining', 'lost'] as const)(
    'gives a %s flamekeeper-only account no Contact or About you and graduation under Flamekeeper',
    (state) => {
      const rules = getAccessRules({ ...base, flamekeeperState: state })
      expect(rules.showFlamekeeperSection).toBe(true)
      expect(rules.showAboutYou).toBe(false)
      expect(rules.showContact).toBe(false)
      expect(rules.graduationUnderFlamekeeper).toBe(true)
      expect(rules.canJoinClub).toBe(true)
    }
  )

  it('shows the Flamekeeper section to an NU account that is not flamekeeping', () => {
    for (const state of [null, 'drained'] as const) {
      const rules = getAccessRules({ ...base, flamekeeperState: state })
      expect(rules.showFlamekeeperSection).toBe(true)
      expect(rules.graduationUnderFlamekeeper).toBe(false)
    }
  })

  it('hides the Flamekeeper section from an account that cannot flamekeep', () => {
    const rules = getAccessRules({ ...base, email: 'jane@gmail.com' })
    expect(rules.showFlamekeeperSection).toBe(false)
    expect(rules.showAboutYou).toBe(false)
    expect(rules.canJoinClub).toBe(true)
    expect(rules.canDeleteAccount).toBe(true)
  })

  it('offers Edit and Stop only while the flamekeeper is keeping', () => {
    for (const state of ['active', 'full'] as const) {
      const rules = getAccessRules({ ...base, flamekeeperState: state })
      expect(rules.canEditPledge).toBe(true)
      expect(rules.canStopFlamekeeping).toBe(true)
    }
    for (const state of [null, 'draining', 'lost', 'drained'] as const) {
      const rules = getAccessRules({ ...base, flamekeeperState: state })
      expect(rules.canEditPledge).toBe(false)
      expect(rules.canStopFlamekeeping).toBe(false)
    }
  })
})
