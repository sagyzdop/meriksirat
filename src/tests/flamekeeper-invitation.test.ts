import { describe, expect, it } from 'vitest'
import {
  nonMemberCanVisit,
  showFlamekeeperInvitation,
  type FlamekeeperInvitationUser,
} from '../lib/access/access-rules'

const nu: FlamekeeperInvitationUser = {
  isMember: false,
  role: 'user',
  email: 'jane@nu.edu.kz',
  flamekeeperState: null,
}

describe('showFlamekeeperInvitation', () => {
  it('invites an NU user who has not been invited before', () => {
    expect(showFlamekeeperInvitation(nu)).toBe(true)
    expect(showFlamekeeperInvitation({ ...nu, isMember: true })).toBe(true)
  })

  it('stays gone once dismissed', () => {
    expect(
      showFlamekeeperInvitation({
        ...nu,
        invitationDismissedAt: new Date('2026-11-01'),
      })
    ).toBe(false)
  })

  it('never shows to alumni or other domains', () => {
    expect(
      showFlamekeeperInvitation({ ...nu, email: 'a@alumni.nu.edu.kz' })
    ).toBe(false)
    expect(showFlamekeeperInvitation({ ...nu, email: 'j@gmail.com' })).toBe(
      false
    )
  })

  it('never shows to anyone who has flamekeeped', () => {
    for (const state of [
      'active',
      'full',
      'draining',
      'lost',
      'drained',
    ] as const) {
      expect(
        showFlamekeeperInvitation({ ...nu, flamekeeperState: state })
      ).toBe(false)
    }
  })

  it('never shows to the master account', () => {
    expect(showFlamekeeperInvitation({ ...nu, isMaster: true })).toBe(false)
  })
})

describe('become a flamekeeper page access', () => {
  it('lets non-members reach the page', () => {
    expect(nonMemberCanVisit('/become-flamekeeper')).toBe(true)
  })
})
