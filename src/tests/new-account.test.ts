import { describe, expect, it } from 'vitest'
import { planNewAccount } from '@/lib/auth/new-account'
import { SIGNUP_REFUSED_ERROR } from '@/lib/auth/signup-domain'

const now = new Date('2026-05-01T10:00:00Z')

describe('planNewAccount', () => {
  it.each(['a@nu.edu.kz', 'a@alumni.nu.edu.kz'])(
    'creates %s and stores the acceptance time',
    (email) => {
      expect(planNewAccount(email, now)).toEqual({
        ok: true,
        termsAcceptedAt: now,
      })
    }
  )

  it('keeps the domain limit', () => {
    expect(planNewAccount('a@gmail.com', now)).toEqual({
      ok: false,
      error: SIGNUP_REFUSED_ERROR,
    })
    expect(planNewAccount(undefined, now)).toEqual({
      ok: false,
      error: SIGNUP_REFUSED_ERROR,
    })
  })
})
