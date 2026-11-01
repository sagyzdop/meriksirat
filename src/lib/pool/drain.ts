import type { FlamekeeperState } from '@/lib/access/access-rules'
import { DRAIN_GRACE_MS } from '@/lib/flamekeeper/rules'

export type DrainReason = 'opt_out' | 'pledge' | 'graduation' | 'domain' | 'ban'

const DRAIN_REMINDER_MS = 3 * 24 * 60 * 60 * 1000

export interface DrainFlamekeeper {
  state: FlamekeeperState
  pledgedBytes: number
  usedBytes: number
  drainReason: DrainReason | null
  drainingDeadline: Date | null
  drainReminderSentAt: Date | null
}

export type DrainTransition =
  | {
      kind: 'drain'
      state: 'draining'
      drainReason: DrainReason
      drainingDeadline: Date
    }
  | { kind: 'drained' }
  | { kind: 'resume' }
  | { kind: 'none' }
  | { kind: 'refuse'; message: string }

export function startDrain(reason: DrainReason, now: Date): DrainTransition {
  return {
    kind: 'drain',
    state: 'draining',
    drainReason: reason,
    drainingDeadline: new Date(now.getTime() + DRAIN_GRACE_MS),
  }
}

export function planOptOut(
  fk: DrainFlamekeeper,
  now: Date,
  hasPhotos: boolean = fk.usedBytes > 0
): DrainTransition {
  switch (fk.state) {
    case 'drained':
      return {
        kind: 'refuse',
        message: 'You have already stopped flamekeeping',
      }
    case 'lost':
      return {
        kind: 'refuse',
        message: 'Reconnect Drive first so your photos can be moved',
      }
    case 'draining':
      if (fk.drainReason === 'opt_out' || fk.drainReason === 'ban') {
        return { kind: 'none' }
      }
  }
  if (!hasPhotos) return { kind: 'drained' }
  return startDrain('opt_out', now)
}

export function planPledgeChange(
  fk: DrainFlamekeeper,
  pledgedBytes: number,
  now: Date
): DrainTransition {
  const below = pledgedBytes < fk.usedBytes
  switch (fk.state) {
    case 'active':
      return below ? startDrain('pledge', now) : { kind: 'none' }
    case 'full':
      if (below) return startDrain('pledge', now)
      return pledgedBytes > fk.usedBytes ? { kind: 'resume' } : { kind: 'none' }
    case 'draining':
      if (fk.drainReason === 'pledge' && !below) return { kind: 'resume' }
      return { kind: 'none' }
    default:
      return { kind: 'none' }
  }
}

export function drainBytesLeft(
  fk: Pick<
    DrainFlamekeeper,
    'state' | 'drainReason' | 'pledgedBytes' | 'usedBytes'
  >
): number {
  if (fk.state !== 'draining') return 0
  if (fk.drainReason === 'pledge') {
    return Math.max(0, fk.usedBytes - fk.pledgedBytes)
  }
  return Math.max(0, fk.usedBytes)
}

export function planDrainProgress(
  fk: DrainFlamekeeper,
  hasPhotos: boolean
): DrainTransition {
  if (fk.state !== 'draining') return { kind: 'none' }
  if (fk.drainReason === 'pledge') {
    return fk.usedBytes <= fk.pledgedBytes
      ? { kind: 'resume' }
      : { kind: 'none' }
  }
  return hasPhotos ? { kind: 'none' } : { kind: 'drained' }
}

export function isDrainOverdue(fk: DrainFlamekeeper, now: Date): boolean {
  return (
    fk.state === 'draining' &&
    !!fk.drainingDeadline &&
    now.getTime() >= fk.drainingDeadline.getTime()
  )
}

export function drainReminderDue(fk: DrainFlamekeeper, now: Date): boolean {
  if (fk.state !== 'draining' || !fk.drainingDeadline) return false
  if (fk.drainReminderSentAt) return false
  const left = fk.drainingDeadline.getTime() - now.getTime()
  return left > 0 && left <= DRAIN_REMINDER_MS
}

export interface DrainAdminAlertState {
  state: FlamekeeperState
  drainingDeadline: Date | null
  drainAdminStartedAt: Date | null
  drainAdminRemindedAt: Date | null
}

export type DrainAdminAlert = 'started' | 'reminder' | null

export function drainAdminAlertDue(
  fk: DrainAdminAlertState,
  now: Date
): DrainAdminAlert {
  if (fk.state !== 'draining' || !fk.drainingDeadline) return null
  if (!fk.drainAdminStartedAt) return 'started'
  if (fk.drainAdminRemindedAt) return null
  const left = fk.drainingDeadline.getTime() - now.getTime()
  return left > 0 && left <= DRAIN_REMINDER_MS ? 'reminder' : null
}

export function pickDeadlineDeletions<T extends { id: string; bytes: number }>(
  fk: DrainFlamekeeper,
  photos: T[]
): T[] {
  if (fk.drainReason !== 'pledge') return photos
  let left = drainBytesLeft(fk)
  const picked: T[] = []
  for (const p of [...photos].sort(
    (a, b) => b.bytes - a.bytes || (a.id < b.id ? -1 : 1)
  )) {
    if (left <= 0) break
    picked.push(p)
    left -= p.bytes
  }
  return picked
}
