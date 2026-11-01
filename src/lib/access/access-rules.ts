export type FlamekeeperState =
  'active' | 'full' | 'draining' | 'lost' | 'drained'

export interface AccessUser {
  isMember: boolean
  role: 'user' | 'manager' | 'admin' | null
  email: string
  flamekeeperState?: FlamekeeperState | null
}

export interface AccessRules {
  canBook: boolean
  canCreateAlbum: boolean
  canFavorite: boolean
  canHoldStaffRole: boolean
  canBecomeFlamekeeper: boolean
  canDeleteAccount: boolean
}

export const FLAMEKEEPER_EMAIL_DOMAIN = '@nu.edu.kz'

export function normalizeClubCode(code: string): string {
  return code.trim().toLowerCase()
}

export function clubCodeMatches(
  input: string,
  current: string | null | undefined
): boolean {
  if (!current) return false
  const expected = normalizeClubCode(current)
  return expected.length > 0 && normalizeClubCode(input) === expected
}

export function getAccessRules(user: AccessUser): AccessRules {
  const flamekeeperState = user.flamekeeperState ?? null
  const hasFlamekeeperRecord = flamekeeperState !== null
  const isFlamekeeping = hasFlamekeeperRecord && flamekeeperState !== 'drained'
  return {
    canBook: user.isMember,
    canCreateAlbum: user.isMember,
    canFavorite: true,
    canHoldStaffRole: user.isMember,
    canBecomeFlamekeeper:
      user.email.trim().toLowerCase().endsWith(FLAMEKEEPER_EMAIL_DOMAIN) &&
      !isFlamekeeping,
    canDeleteAccount: !user.isMember && !isFlamekeeping,
  }
}

export interface EntryUser {
  isMember: boolean
  onboardingComplete?: boolean | null
  flamekeeperState?: FlamekeeperState | null
  termsAcceptedAt?: Date | string | number | null
}

export function needsOnboarding(user: EntryUser): boolean {
  if (user.isMember) return !user.onboardingComplete
  return !user.flamekeeperState && !user.termsAcceptedAt
}

export type HomePath = '/onboarding' | '/equipment' | '/profile'

export function homePath(user: EntryUser): HomePath {
  if (needsOnboarding(user)) return '/onboarding'
  return user.isMember ? '/equipment' : '/profile'
}

const NON_MEMBER_PATHS = ['/profile', '/favorites']

export function nonMemberCanVisit(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/'
  return NON_MEMBER_PATHS.some(
    (path) => clean === path || clean.startsWith(`${path}/`)
  )
}
