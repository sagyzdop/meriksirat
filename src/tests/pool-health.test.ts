import { describe, expect, it } from 'vitest'
import {
  HEALTH_INTERVAL_MS,
  LOST_GRACE_MS,
  canBecomeLost,
  isInvalidGrantResponse,
  planHealthBatch,
  planEmailSync,
  planLost,
  isUniqueConstraintError,
  type HealthCandidate,
  type LostFlamekeeper,
} from '@/lib/pool/health'

const now = new Date('2026-11-10T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)

const cand = (over: Partial<HealthCandidate>): HealthCandidate => ({
  userId: 'a',
  state: 'active',
  healthCheckedAt: null,
  ...over,
})

const lost = (over: Partial<LostFlamekeeper>): LostFlamekeeper => ({
  userId: 'a',
  state: 'lost',
  lostSince: ago(1000),
  lostNotifiedAt: null,
  lostFinalizedAt: null,
  ...over,
})

describe('grant failure classification', () => {
  it('treats invalid_grant as permanent', () => {
    expect(isInvalidGrantResponse(400, '{"error":"invalid_grant"}')).toBe(true)
  })
  it('treats other failures as transient', () => {
    expect(isInvalidGrantResponse(500, 'invalid_grant')).toBe(false)
    expect(isInvalidGrantResponse(400, '{"error":"invalid_client"}')).toBe(
      false
    )
  })
  it('only live states can become lost', () => {
    expect(canBecomeLost('active')).toBe(true)
    expect(canBecomeLost('full')).toBe(true)
    expect(canBecomeLost('draining')).toBe(true)
    expect(canBecomeLost('lost')).toBe(false)
    expect(canBecomeLost('drained')).toBe(false)
  })
})

describe('planHealthBatch', () => {
  it('takes never-checked and day-old flamekeepers, oldest first', () => {
    const picked = planHealthBatch(
      [
        cand({ userId: 'fresh', healthCheckedAt: ago(1000) }),
        cand({ userId: 'old', healthCheckedAt: ago(HEALTH_INTERVAL_MS + 5) }),
        cand({ userId: 'never' }),
      ],
      now,
      10
    )
    expect(picked).toEqual(['never', 'old'])
  })
  it('skips lost and drained flamekeepers', () => {
    expect(
      planHealthBatch(
        [cand({ userId: 'l', state: 'lost' }), cand({ state: 'drained' })],
        now,
        10
      )
    ).toEqual([])
  })
  it('takes as many as the budget covers', () => {
    const many = [
      cand({ userId: 'a' }),
      cand({ userId: 'b' }),
      cand({ userId: 'c' }),
    ]
    expect(planHealthBatch(many, now, 4)).toEqual(['a', 'b'])
    expect(planHealthBatch(many, now, 1)).toEqual([])
    expect(planHealthBatch(many, now, 0)).toEqual([])
  })
  it('keeps checking a flamekeeper who is still draining from before', () => {
    expect(planHealthBatch([cand({ state: 'draining' })], now, 2)).toEqual([
      'a',
    ])
  })
})

describe('planLost', () => {
  it('sends one reconnect email on the lost transition', () => {
    expect(planLost([lost({})], now).notify).toEqual(['a'])
    expect(planLost([lost({ lostNotifiedAt: ago(500) })], now).notify).toEqual(
      []
    )
  })
  it('waits out the 7-day window before finalizing', () => {
    const plan = planLost([lost({ lostSince: ago(LOST_GRACE_MS - 1000) })], now)
    expect(plan.finalize).toEqual([])
  })
  it('finalizes once the window ends, only once', () => {
    const since = ago(LOST_GRACE_MS)
    expect(planLost([lost({ lostSince: since })], now).finalize).toEqual(['a'])
    expect(
      planLost([lost({ lostSince: since, lostFinalizedAt: ago(10) })], now)
        .finalize
    ).toEqual([])
  })
  it('sends no reconnect email to a banned flamekeeper', () => {
    const plan = planLost([lost({ banned: true })], now)
    expect(plan.notify).toEqual([])
  })
  it('still finalizes a banned flamekeeper', () => {
    const plan = planLost(
      [lost({ banned: true, lostSince: ago(LOST_GRACE_MS) })],
      now
    )
    expect(plan.finalize).toEqual(['a'])
  })
  it('ignores a reconnected flamekeeper', () => {
    const plan = planLost(
      [lost({ state: 'active', lostSince: null }), lost({ userId: 'b' })],
      now
    )
    expect(plan.notify).toEqual(['b'])
    expect(plan.finalize).toEqual([])
  })
})

describe('planEmailSync', () => {
  it('overwrites a different email', () => {
    expect(planEmailSync('a@nu.edu.kz', 'a@alumni.nu.edu.kz')).toEqual({
      kind: 'update',
      email: 'a@alumni.nu.edu.kz',
    })
  })
  it('ignores the same email regardless of case', () => {
    expect(planEmailSync('a@nu.edu.kz', ' A@NU.edu.kz ')).toEqual({
      kind: 'none',
    })
  })
  it('does not trust a missing or malformed email', () => {
    expect(planEmailSync('a@nu.edu.kz', undefined)).toEqual({ kind: 'none' })
    expect(planEmailSync('a@nu.edu.kz', null)).toEqual({ kind: 'none' })
    expect(planEmailSync('a@nu.edu.kz', '')).toEqual({ kind: 'none' })
    expect(planEmailSync('a@nu.edu.kz', 'nonsense')).toEqual({ kind: 'none' })
  })
})

describe('isUniqueConstraintError', () => {
  it('spots D1 unique failures, also as a cause', () => {
    expect(
      isUniqueConstraintError(new Error('UNIQUE constraint failed: user.email'))
    ).toBe(true)
    expect(
      isUniqueConstraintError(
        new Error('Failed query', {
          cause: new Error('D1_ERROR: UNIQUE constraint failed: user.email'),
        })
      )
    ).toBe(true)
    expect(isUniqueConstraintError(new Error('network down'))).toBe(false)
  })
})
