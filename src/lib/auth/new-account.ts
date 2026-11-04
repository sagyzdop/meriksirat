import { SIGNUP_REFUSED_ERROR, isAllowedSignupEmail } from './signup-domain'

export type NewAccountPlan =
  { ok: true; termsAcceptedAt: Date } | { ok: false; error: string }

export function planNewAccount(
  email: string | null | undefined,
  now: Date
): NewAccountPlan {
  if (!isAllowedSignupEmail(email)) {
    return { ok: false, error: SIGNUP_REFUSED_ERROR }
  }
  return { ok: true, termsAcceptedAt: now }
}
