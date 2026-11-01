import { describe, expect, it } from 'vitest'
import { isAllowedSignupEmail, signupKind } from '@/lib/auth/signup-domain'

describe('isAllowedSignupEmail', () => {
  it.each([
    'a@nu.edu.kz',
    'A.B@NU.EDU.KZ',
    '  a@nu.edu.kz ',
    'a@alumni.nu.edu.kz',
  ])('allows %s', (email) => {
    expect(isAllowedSignupEmail(email)).toBe(true)
  })

  it.each([
    'a@gmail.com',
    'a@evilnu.edu.kz',
    'a@evil-nu.edu.kz',
    'a@nu.edu.kz.evil.com',
    'a@sub.nu.edu.kz',
    'a@alumni.nu.edu.kz.com',
    'a@xalumni.nu.edu.kz',
    'nu.edu.kz',
    '@nu.edu.kz',
    '',
    null,
    undefined,
  ])('refuses %s', (email) => {
    expect(isAllowedSignupEmail(email)).toBe(false)
  })
})

describe('signupKind', () => {
  it('tells NU, alumni and other accounts apart', () => {
    expect(signupKind('a@nu.edu.kz')).toBe('nu')
    expect(signupKind('a@alumni.nu.edu.kz')).toBe('alumni')
    expect(signupKind('a@gmail.com')).toBe('other')
  })
})
