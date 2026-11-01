import type { FlamekeeperState } from '@/lib/access/access-rules'

export const HEALTH_INTERVAL_MS = 24 * 60 * 60 * 1000
export const LOST_GRACE_MS = 7 * 24 * 60 * 60 * 1000
export const HEALTH_SUBREQUEST_BUDGET = 12

export interface HealthCandidate {
  userId: string
  state: FlamekeeperState
  healthCheckedAt: Date | null
  volumeCount: number
}

export interface LostFlamekeeper {
  userId: string
  state: FlamekeeperState
  lostSince: Date | null
  lostNotifiedAt: Date | null
  lostFinalizedAt: Date | null
}

export interface LostPlan {
  notify: string[]
  finalize: string[]
}

export function isInvalidGrantResponse(status: number, body: string): boolean {
  if (status !== 400 && status !== 401) return false
  return body.includes('invalid_grant')
}

export function canBecomeLost(state: FlamekeeperState): boolean {
  return state === 'active' || state === 'full' || state === 'draining'
}

export function auditCost(volumeCount: number): number {
  return 1 + volumeCount
}

/**
 * Pick the flamekeepers to check in this cron run: those not checked for a
 * day, least recently checked first, as many as fit the subrequest budget
 * (one token refresh plus one listing per volume). The first is always taken
 * so an oversized flamekeeper still gets checked.
 */
export function planHealthBatch(
  candidates: HealthCandidate[],
  now: Date,
  budget: number = HEALTH_SUBREQUEST_BUDGET
): string[] {
  const nowMs = now.getTime()
  const due = candidates
    .filter(
      (c) =>
        (c.state === 'active' ||
          c.state === 'full' ||
          c.state === 'draining') &&
        (!c.healthCheckedAt ||
          nowMs - c.healthCheckedAt.getTime() >= HEALTH_INTERVAL_MS)
    )
    .sort(
      (a, b) =>
        (a.healthCheckedAt?.getTime() ?? 0) -
        (b.healthCheckedAt?.getTime() ?? 0)
    )

  const picked: string[] = []
  let spent = 0
  for (const c of due) {
    const cost = auditCost(c.volumeCount)
    if (picked.length > 0 && spent + cost > budget) break
    picked.push(c.userId)
    spent += cost
  }
  return picked
}

export function lostDeadline(lostSince: Date): Date {
  return new Date(lostSince.getTime() + LOST_GRACE_MS)
}

/**
 * Lost flamekeepers owe one reconnect email, and once the 7-day window ends
 * their photos drop out of the app. A reconnect resets the state to active,
 * so those flamekeepers never reach this plan.
 */
export function planLost(fks: LostFlamekeeper[], now: Date): LostPlan {
  const plan: LostPlan = { notify: [], finalize: [] }
  for (const fk of fks) {
    if (fk.state !== 'lost' || !fk.lostSince) continue
    if (!fk.lostNotifiedAt) plan.notify.push(fk.userId)
    if (
      !fk.lostFinalizedAt &&
      now.getTime() >= lostDeadline(fk.lostSince).getTime()
    ) {
      plan.finalize.push(fk.userId)
    }
  }
  return plan
}

export interface PhotoRef {
  id: string
  driveFileId: string
}

export function findMissingPhotos(
  dbPhotos: PhotoRef[],
  driveFileIds: Iterable<string>
): PhotoRef[] {
  const present = new Set(driveFileIds)
  return dbPhotos.filter((p) => !present.has(p.driveFileId))
}
