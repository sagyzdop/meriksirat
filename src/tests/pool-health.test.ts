import { describe, expect, it } from 'vitest'
import {
  HEALTH_INTERVAL_MS,
  LOST_GRACE_MS,
  canBecomeLost,
  findMissingPhotos,
  isInvalidGrantResponse,
  planHealthBatch,
  planLost,
  type HealthCandidate,
  type LostFlamekeeper,
} from '@/lib/pool/health'

const now = new Date('2026-11-10T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)

const cand = (over: Partial<HealthCandidate>): HealthCandidate => ({
  userId: 'a',
  state: 'active',
  healthCheckedAt: null,
  volumeCount: 1,
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
      now
    )
    expect(picked).toEqual(['never', 'old'])
  })
  it('skips lost and drained flamekeepers', () => {
    expect(
      planHealthBatch(
        [cand({ userId: 'l', state: 'lost' }), cand({ state: 'drained' })],
        now
      )
    ).toEqual([])
  })
  it('stops at the budget but always takes the first', () => {
    const picked = planHealthBatch(
      [
        cand({ userId: 'a', volumeCount: 20 }),
        cand({ userId: 'b', volumeCount: 1 }),
      ],
      now,
      12
    )
    expect(picked).toEqual(['a'])
    const two = planHealthBatch(
      [
        cand({ userId: 'a', volumeCount: 4 }),
        cand({ userId: 'b', volumeCount: 4 }),
        cand({ userId: 'c', volumeCount: 4 }),
      ],
      now,
      12
    )
    expect(two).toEqual(['a', 'b'])
  })
})

describe('planLost', () => {
  it('sends one reconnect email on the lost transition', () => {
    expect(planLost([lost({})], now).notify).toEqual(['a'])
    expect(planLost([lost({ lostNotifiedAt: ago(500) })], now).notify).toEqual(
      []
    )
  })
  it('keeps photos during the 7-day window', () => {
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
  it('ignores a reconnected flamekeeper', () => {
    const plan = planLost(
      [lost({ state: 'active', lostSince: null }), lost({ userId: 'b' })],
      now
    )
    expect(plan.notify).toEqual(['b'])
    expect(plan.finalize).toEqual([])
  })
})

describe('findMissingPhotos', () => {
  it('returns photos whose Drive file is absent', () => {
    const photos = [
      { id: '1', driveFileId: 'f1' },
      { id: '2', driveFileId: 'f2' },
    ]
    expect(findMissingPhotos(photos, ['f1'])).toEqual([photos[1]])
    expect(findMissingPhotos(photos, ['f1', 'f2'])).toEqual([])
  })
})
