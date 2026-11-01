import {
  startDrain,
  type DrainFlamekeeper,
  type DrainTransition,
} from './drain'

export const BAN_REASON_MAX = 500

export type BanCheck =
  { ok: true; reason: string } | { ok: false; message: string }

export function checkBan(input: {
  actorId: string
  targetId: string
  reason: string
}): BanCheck {
  if (input.actorId === input.targetId) {
    return { ok: false, message: 'You cannot ban yourself' }
  }
  const reason = input.reason.trim()
  if (!reason) return { ok: false, message: 'Give a reason for the ban' }
  if (reason.length > BAN_REASON_MAX) {
    return {
      ok: false,
      message: `Keep the reason under ${BAN_REASON_MAX} characters`,
    }
  }
  return { ok: true, reason }
}

/**
 * Banning a flamekeeper starts a full drain with its own reason. A lost or
 * drained flamekeeper keeps the state it is in, and a ban drain already
 * running is left alone.
 */
export function planBanDrain(
  fk: DrainFlamekeeper | null,
  hasPhotos: boolean,
  now: Date
): DrainTransition {
  if (!fk) return { kind: 'none' }
  switch (fk.state) {
    case 'active':
    case 'full':
      return hasPhotos ? startDrain('ban', now) : { kind: 'drained' }
    case 'draining':
      return fk.drainReason === 'ban'
        ? { kind: 'none' }
        : startDrain('ban', now)
    default:
      return { kind: 'none' }
  }
}

export function pickPendingRevokes<T extends { writerRevokedAt: Date | null }>(
  volumes: T[],
  limit: number
): T[] {
  return volumes.filter((v) => !v.writerRevokedAt).slice(0, limit)
}
