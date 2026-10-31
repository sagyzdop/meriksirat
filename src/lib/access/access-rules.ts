export type FlamekeeperState =
  'active' | 'full' | 'draining' | 'lost' | 'drained'

export interface AccessUser {
  isMember: boolean
  role: 'user' | 'manager' | 'admin' | null
  email: string
  flamekeeperState?: FlamekeeperState | null
}

export type OnboardingPath = 'choose' | 'member' | 'flamekeeper'

export interface AccessRules {
  canBook: boolean
  canCreateAlbum: boolean
  canFavorite: boolean
  canHoldStaffRole: boolean
  canBecomeFlamekeeper: boolean
  canDeleteAccount: boolean
  onboardingPath: OnboardingPath
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
  const onboardingPath: OnboardingPath = user.isMember
    ? 'member'
    : hasFlamekeeperRecord
      ? 'flamekeeper'
      : 'choose'

  return {
    canBook: user.isMember,
    canCreateAlbum: user.isMember,
    canFavorite: user.isMember || hasFlamekeeperRecord,
    canHoldStaffRole: user.isMember,
    canBecomeFlamekeeper:
      user.email.trim().toLowerCase().endsWith(FLAMEKEEPER_EMAIL_DOMAIN) &&
      !isFlamekeeping,
    canDeleteAccount: !user.isMember && flamekeeperState === 'drained',
    onboardingPath,
  }
}
