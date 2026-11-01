import { isAlumniEmail } from './signup-domain'

export const STALE_SIGNUP_DAYS = 7
export const STALE_SIGNUP_MAX_DELETES = 20

const DAY_MS = 24 * 60 * 60 * 1000

export interface SignupCandidate {
  id: string
  email: string
  isMember: boolean
  hasFlamekeeperRecord: boolean
  hasDriveGrant: boolean
  createdAt: Date
  ownsAnything: boolean
  bannedAt: Date | null
}

export function selectStaleSignups(
  users: SignupCandidate[],
  now: Date,
  max: number = STALE_SIGNUP_MAX_DELETES
): string[] {
  const cutoff = now.getTime() - STALE_SIGNUP_DAYS * DAY_MS
  return users
    .filter(
      (u) =>
        !u.bannedAt &&
        !isAlumniEmail(u.email) &&
        !u.isMember &&
        !u.hasFlamekeeperRecord &&
        !u.hasDriveGrant &&
        !u.ownsAnything &&
        u.createdAt.getTime() <= cutoff
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, max)
    .map((u) => u.id)
}
