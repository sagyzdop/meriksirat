import { describe, expect, it } from 'vitest'
import {
  TERMS_REFUSED_ERROR,
  planNewAccount,
  readTermsAccepted,
} from '@/lib/auth/new-account'
import { SIGNUP_REFUSED_ERROR } from '@/lib/auth/signup-domain'

const now = new Date('2026-05-01T10:00:00Z')

describe('planNewAccount', () => {
  it.each(['a@nu.edu.kz', 'a@alumni.nu.edu.kz'])(
    'creates %s with the terms date saved when terms are accepted',
    (email) => {
      expect(planNewAccount(email, true, now)).toEqual({
        ok: true,
        termsAcceptedAt: now,
      })
    }
  )

  it.each([false, undefined])(
    'refuses a new account when terms are %s',
    (accepted) => {
      expect(planNewAccount('a@nu.edu.kz', accepted, now)).toEqual({
        ok: false,
        error: TERMS_REFUSED_ERROR,
      })
    }
  )

  it('keeps the domain limit, which wins over the terms error', () => {
    expect(planNewAccount('a@gmail.com', true, now)).toEqual({
      ok: false,
      error: SIGNUP_REFUSED_ERROR,
    })
    expect(planNewAccount('a@gmail.com', false, now)).toEqual({
      ok: false,
      error: SIGNUP_REFUSED_ERROR,
    })
  })
})

describe('readTermsAccepted', () => {
  it('is true only for an explicit true', () => {
    expect(readTermsAccepted({ termsAccepted: true })).toBe(true)
    expect(readTermsAccepted({ termsAccepted: 'true' })).toBe(false)
    expect(readTermsAccepted({ termsAccepted: 1 })).toBe(false)
    expect(readTermsAccepted({})).toBe(false)
    expect(readTermsAccepted(null)).toBe(false)
    expect(readTermsAccepted(undefined)).toBe(false)
  })
})
