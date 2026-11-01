import { describe, expect, it } from 'vitest'
import { isMasterEmail } from '@/lib/flamekeeper/master'
import { placeUpload, type PoolFlamekeeper } from '@/lib/pool/placement'
import { homePath, needsOnboarding } from '@/lib/access/access-rules'

const MASTER = 'nu_image@nu.edu.kz'

function fk(userId: string, email: string, pledged = 10): PoolFlamekeeper {
  return {
    userId,
    email,
    state: 'active',
    pledgedBytes: pledged,
    usedBytes: 0,
    reservedBytes: 0,
    driveUsageBytes: 0,
  }
}

describe('isMasterEmail', () => {
  it('matches trimmed and case-insensitive', () => {
    expect(isMasterEmail('  NU_Image@nu.edu.kz ', MASTER)).toBe(true)
    expect(isMasterEmail(MASTER, ` ${MASTER.toUpperCase()}`)).toBe(true)
  })

  it('rejects other emails', () => {
    expect(isMasterEmail('someone@nu.edu.kz', MASTER)).toBe(false)
  })

  it('treats nobody as master when unset or blank', () => {
    expect(isMasterEmail(MASTER, undefined)).toBe(false)
    expect(isMasterEmail(MASTER, '')).toBe(false)
    expect(isMasterEmail(MASTER, '   ')).toBe(false)
    expect(isMasterEmail(undefined, MASTER)).toBe(false)
  })
})

describe('placeUpload with master', () => {
  it('never places on the master even with the most room', () => {
    const fks = [fk('m', MASTER, 1000), fk('a', 'a@nu.edu.kz', 10)]
    expect(
      placeUpload(fks, { bytes: 1, capBytes: 1000, masterEmail: MASTER })
    ).toEqual({ kind: 'placed', userId: 'a' })
  })

  it('reports no space when only the master has room', () => {
    expect(
      placeUpload([fk('m', ` ${MASTER.toUpperCase()}`, 1000)], {
        bytes: 1,
        capBytes: 1000,
        masterEmail: MASTER,
      })
    ).toEqual({ kind: 'no_space' })
  })

  it('is unchanged when no master is configured', () => {
    expect(
      placeUpload([fk('m', MASTER, 1000)], { bytes: 1, capBytes: 1000 })
    ).toEqual({ kind: 'placed', userId: 'm' })
  })
})

describe('master onboarding', () => {
  it('does not trap a non-member master in onboarding', () => {
    const u = { isMember: false, isMaster: true }
    expect(needsOnboarding(u)).toBe(false)
    expect(homePath(u)).toBe('/profile')
  })

  it('still requires onboarding for a member master', () => {
    expect(
      needsOnboarding({
        isMember: true,
        isMaster: true,
        onboardingComplete: false,
      })
    ).toBe(true)
  })
})
