import { SIGNUP_REFUSED_ERROR, isAllowedSignupEmail } from './signup-domain'

export const TERMS_REFUSED_ERROR = 'terms_not_accepted'
export const TERMS_REFUSED_MESSAGE =
  'Accept the terms of service to create an account.'

export type NewAccountPlan =
  { ok: true; termsAcceptedAt: Date } | { ok: false; error: string }

export function planNewAccount(
  email: string | null | undefined,
  termsAccepted: boolean | undefined,
  now: Date
): NewAccountPlan {
  if (!isAllowedSignupEmail(email)) {
    return { ok: false, error: SIGNUP_REFUSED_ERROR }
  }
  if (termsAccepted !== true) {
    return { ok: false, error: TERMS_REFUSED_ERROR }
  }
  return { ok: true, termsAcceptedAt: now }
}

export function readTermsAccepted(state: unknown): boolean {
  if (typeof state !== 'object' || state === null) return false
  return (state as { termsAccepted?: unknown }).termsAccepted === true
}
