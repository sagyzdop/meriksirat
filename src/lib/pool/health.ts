import type { FlamekeeperState } from '@/lib/access/access-rules'

export const HEALTH_INTERVAL_MS = 24 * 60 * 60 * 1000
export const LOST_GRACE_MS = 7 * 24 * 60 * 60 * 1000
export const HEALTH_STEP_CAP = 24
export const HEALTH_PASS_COST = 2
export const MISSING_GRACE_MS = 60 * 60 * 1000
export const RESTORE_BATCH = 300

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
  banned?: boolean
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

/**
 * Pick the flamekeepers to check in this cron run: those not checked for a
 * day, least recently checked first, as many as `budget` requests allow at
 * the least a check needs (a token refresh and one listing). The audit itself
 * stops when the shared budget runs out and carries on from a cursor.
 */
export function planHealthBatch(
  candidates: HealthCandidate[],
  now: Date,
  budget: number
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
    const cost = c.volumeCount > 0 ? HEALTH_PASS_COST : 1
    if (spent + cost > budget) break
    picked.push(c.userId)
    spent += cost
  }
  return picked
}

/**
 * Volumes still to audit in this pass: those after the cursor, in album-ID
 * order, so a pass cut short by the budget resumes where it stopped.
 */
export function volumesAfterCursor(
  albumIds: string[],
  cursor: string | null
): string[] {
  return [...albumIds].sort().filter((id) => !cursor || id > cursor)
}

export interface EmailSync {
  kind: 'none' | 'update'
  email?: string
}

/**
 * Google's view of the account email wins over the saved one. A missing or
 * malformed value from Google is never trusted.
 */
export function planEmailSync(
  saved: string,
  reported: string | null | undefined
): EmailSync {
  const next = reported?.trim().toLowerCase()
  if (!next || !/^[^\s@]+@[^\s@]+$/.test(next)) return { kind: 'none' }
  if (next === saved.trim().toLowerCase()) return { kind: 'none' }
  return { kind: 'update', email: next }
}

export function isUniqueConstraintError(error: unknown): boolean {
  const text = [
    error instanceof Error ? error.message : '',
    (error as { cause?: { message?: string } } | null)?.cause?.message ?? '',
  ].join(' ')
  return /unique|constraint/i.test(text)
}

export function lostDeadline(lostSince: Date): Date {
  return new Date(lostSince.getTime() + LOST_GRACE_MS)
}

/**
 * Lost flamekeepers owe one reconnect email (not banned ones, who cannot
 * sign in), and once the 7-day window ends their photos drop out of the app
 * until they reconnect. A reconnect resets the state to active, so those
 * flamekeepers never reach this plan.
 */
export function planLost(fks: LostFlamekeeper[], now: Date): LostPlan {
  const plan: LostPlan = { notify: [], finalize: [] }
  for (const fk of fks) {
    if (fk.state !== 'lost' || !fk.lostSince) continue
    if (!fk.lostNotifiedAt && !fk.banned) plan.notify.push(fk.userId)
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

export interface RecoveryAlbum {
  deletedAt: Date | null
  tombstoneReason: string | null
  expiresAt: Date | null
  pinned: boolean
}

export type RecoveryAction = 'restore' | 'abandon'

/**
 * Dropped photos come back unless their album is gone for another reason or
 * has passed its expiry date, in which case they stay gone for good.
 */
export function planRecovery(album: RecoveryAlbum, now: Date): RecoveryAction {
  if (album.deletedAt && album.tombstoneReason !== 'flamekeeper_lost') {
    return 'abandon'
  }
  if (
    !album.pinned &&
    album.expiresAt &&
    album.expiresAt.getTime() <= now.getTime()
  ) {
    return 'abandon'
  }
  return 'restore'
}

/** Whether a photo is old enough to be judged missing from a Drive listing. */
export function oldEnoughToAudit(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= MISSING_GRACE_MS
}
