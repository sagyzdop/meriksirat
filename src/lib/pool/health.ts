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

export function oldEnoughToAudit(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= MISSING_GRACE_MS
}
