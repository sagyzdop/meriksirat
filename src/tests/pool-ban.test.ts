import { describe, expect, it } from 'vitest'
import { DRAIN_GRACE_MS } from '@/lib/flamekeeper/rules'
import {
  BAN_REASON_MAX,
  checkBan,
  pickPendingRevokes,
  planBanDrain,
} from '@/lib/pool/ban'
import { planOptOut, type DrainFlamekeeper } from '@/lib/pool/drain'

const GB = 1024 * 1024 * 1024
const NOW = new Date('2026-11-01T10:00:00Z')

function fk(overrides: Partial<DrainFlamekeeper> = {}): DrainFlamekeeper {
  return {
    state: 'active',
    pledgedBytes: 10 * GB,
    usedBytes: 4 * GB,
    drainReason: null,
    drainingDeadline: null,
    drainReminderSentAt: null,
    ...overrides,
  }
}

describe('checkBan', () => {
  it('accepts a reason about someone else and trims it', () => {
    expect(
      checkBan({ actorId: 'a', targetId: 'b', reason: '  deleted  ' })
    ).toEqual({ ok: true, reason: 'deleted' })
  })

  it('refuses banning yourself', () => {
    expect(checkBan({ actorId: 'a', targetId: 'a', reason: 'x' }).ok).toBe(
      false
    )
  })

  it('requires a reason', () => {
    expect(checkBan({ actorId: 'a', targetId: 'b', reason: '   ' }).ok).toBe(
      false
    )
  })

  it('caps the reason length', () => {
    const reason = 'x'.repeat(BAN_REASON_MAX + 1)
    expect(checkBan({ actorId: 'a', targetId: 'b', reason }).ok).toBe(false)
  })
})

describe('planBanDrain', () => {
  it('does nothing for a user who is not a flamekeeper', () => {
    expect(planBanDrain(null, false, NOW)).toEqual({ kind: 'none' })
  })

  it('starts a ban drain with the normal grace period', () => {
    expect(planBanDrain(fk(), true, NOW)).toEqual({
      kind: 'drain',
      state: 'draining',
      drainReason: 'ban',
      drainingDeadline: new Date(NOW.getTime() + DRAIN_GRACE_MS),
    })
  })

  it('drains full flamekeepers too', () => {
    expect(planBanDrain(fk({ state: 'full' }), true, NOW).kind).toBe('drain')
  })

  it('finishes at once when nothing is held', () => {
    expect(planBanDrain(fk(), false, NOW)).toEqual({ kind: 'drained' })
  })

  it('replaces another drain reason but keeps a ban drain running', () => {
    const other = fk({
      state: 'draining',
      drainReason: 'pledge',
      drainingDeadline: NOW,
    })
    expect(planBanDrain(other, true, NOW)).toMatchObject({
      kind: 'drain',
      drainReason: 'ban',
    })
    const banned = fk({
      state: 'draining',
      drainReason: 'ban',
      drainingDeadline: NOW,
    })
    expect(planBanDrain(banned, true, NOW)).toEqual({ kind: 'none' })
  })

  it('keeps the deadline of a drain already running for another reason', () => {
    const deadline = new Date(NOW.getTime() + 2 * 86_400_000)
    const other = fk({
      state: 'draining',
      drainReason: 'opt_out',
      drainingDeadline: deadline,
    })
    expect(planBanDrain(other, true, NOW)).toEqual({
      kind: 'drain',
      state: 'draining',
      drainReason: 'ban',
      drainingDeadline: deadline,
    })
  })

  it('never extends a running drain, even with a later stored deadline', () => {
    const later = new Date(NOW.getTime() + DRAIN_GRACE_MS * 2)
    const other = fk({
      state: 'draining',
      drainReason: 'pledge',
      drainingDeadline: later,
    })
    expect(planBanDrain(other, true, NOW)).toMatchObject({
      drainingDeadline: new Date(NOW.getTime() + DRAIN_GRACE_MS),
    })
  })

  it('starts a fresh grace period when the running drain has no deadline', () => {
    const other = fk({ state: 'draining', drainReason: 'domain' })
    expect(planBanDrain(other, true, NOW)).toMatchObject({
      drainingDeadline: new Date(NOW.getTime() + DRAIN_GRACE_MS),
    })
  })

  it('leaves lost and drained flamekeepers alone', () => {
    expect(planBanDrain(fk({ state: 'lost' }), true, NOW)).toEqual({
      kind: 'none',
    })
    expect(planBanDrain(fk({ state: 'drained' }), false, NOW)).toEqual({
      kind: 'none',
    })
  })

  it('an opt-out cannot overwrite a ban drain', () => {
    const banned = fk({
      state: 'draining',
      drainReason: 'ban',
      drainingDeadline: NOW,
    })
    expect(planOptOut(banned, NOW, true)).toEqual({ kind: 'none' })
  })
})

describe('pickPendingRevokes', () => {
  it('takes unrevoked volumes up to the limit', () => {
    const volumes = [
      { id: 1, writerRevokedAt: NOW },
      { id: 2, writerRevokedAt: null },
      { id: 3, writerRevokedAt: null },
      { id: 4, writerRevokedAt: null },
    ]
    expect(pickPendingRevokes(volumes, 2).map((v) => v.id)).toEqual([2, 3])
  })
})
