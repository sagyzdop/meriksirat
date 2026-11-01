export const STALE_SIGNUP_DAYS = 7
export const STALE_SIGNUP_MAX_DELETES = 20

const DAY_MS = 24 * 60 * 60 * 1000

export interface SignupCandidate {
  id: string
  isMember: boolean
  createdAt: Date
  ownsAnything: boolean
}

export function selectStaleSignups(
  users: SignupCandidate[],
  now: Date,
  max: number = STALE_SIGNUP_MAX_DELETES
): string[] {
  const cutoff = now.getTime() - STALE_SIGNUP_DAYS * DAY_MS
  return users
    .filter(
      (u) => !u.isMember && !u.ownsAnything && u.createdAt.getTime() <= cutoff
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, max)
    .map((u) => u.id)
}
