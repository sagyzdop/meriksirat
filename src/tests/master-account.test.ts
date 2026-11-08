import { describe, expect, it } from 'vitest'
import { isMasterEmail } from '@/lib/flamekeeper/master'
import { homePath, needsOnboarding } from '@/lib/access/access-rules'

const MASTER = 'nu_image@nu.edu.kz'

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

describe('master onboarding', () => {
  it('does not trap a non-member master in onboarding', () => {
    const u = { isMember: false, isMaster: true }
    expect(needsOnboarding(u)).toBe(false)
    expect(homePath(u)).toBe('/account')
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
