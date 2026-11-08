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
  canJoinClub: boolean
  showFlamekeeperSection: boolean
  showAboutYou: boolean
  graduationUnderFlamekeeper: boolean
  canEditPledge: boolean
  canStopFlamekeeping: boolean
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
  const canBecomeFlamekeeper =
    user.email.trim().toLowerCase().endsWith(FLAMEKEEPER_EMAIL_DOMAIN) &&
    !isFlamekeeping
  const isKeeping = flamekeeperState === 'active' || flamekeeperState === 'full'
  return {
    canBook: user.isMember,
    canCreateAlbum: user.isMember,
    canFavorite: true,
    canHoldStaffRole: user.isMember,
    canBecomeFlamekeeper,
    canDeleteAccount: !user.isMember && !isFlamekeeping,
    canJoinClub: !user.isMember,
    showFlamekeeperSection: isFlamekeeping || canBecomeFlamekeeper,
    showAboutYou: user.isMember,
    graduationUnderFlamekeeper: !user.isMember && isFlamekeeping,
    canEditPledge: isKeeping,
    canStopFlamekeeping: isKeeping,
  }
}

export interface FlamekeeperInvitationUser extends AccessUser {
  isMaster?: boolean
}

export function showFlamekeeperInvitation(
  user: FlamekeeperInvitationUser
): boolean {
  return (
    !user.isMaster &&
    (user.flamekeeperState ?? null) === null &&
    getAccessRules(user).canBecomeFlamekeeper
  )
}

export interface EntryUser {
  isMember: boolean
  onboardingComplete?: boolean | null
  flamekeeperState?: FlamekeeperState | null
  termsAcceptedAt?: Date | string | number | null
  isMaster?: boolean
}

export function needsOnboarding(user: EntryUser): boolean {
  return user.isMember && !user.onboardingComplete
}

export type HomePath = '/onboarding' | '/equipment' | '/account'

export function homePath(user: EntryUser): HomePath {
  if (needsOnboarding(user)) return '/onboarding'
  return user.isMember ? '/equipment' : '/account'
}

const NON_MEMBER_PATHS = ['/account', '/favorites', '/become-flamekeeper']

export function nonMemberCanVisit(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/'
  return NON_MEMBER_PATHS.some(
    (path) => clean === path || clean.startsWith(`${path}/`)
  )
}
