export const NU_DOMAIN = 'nu.edu.kz'
export const ALUMNI_DOMAIN = 'alumni.nu.edu.kz'
export const SIGNUP_REFUSED_ERROR = 'signup_domain_not_allowed'
export const SIGNUP_REFUSED_MESSAGE =
  'New accounts need an @nu.edu.kz or @alumni.nu.edu.kz Google account. Sign in with one of those.'

export type SignupKind = 'nu' | 'alumni' | 'other'

function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf('@')
  if (at < 1) return null
  return normalized.slice(at + 1)
}

export function signupKind(email: string | null | undefined): SignupKind {
  const domain = emailDomain(email)
  if (domain === NU_DOMAIN) return 'nu'
  if (domain === ALUMNI_DOMAIN) return 'alumni'
  return 'other'
}

export function isAllowedSignupEmail(
  email: string | null | undefined
): boolean {
  return signupKind(email) !== 'other'
}

export function isAlumniEmail(email: string | null | undefined): boolean {
  return signupKind(email) === 'alumni'
}
