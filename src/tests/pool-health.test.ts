import { describe, expect, it } from 'vitest'
import {
  HEALTH_INTERVAL_MS,
  LOST_GRACE_MS,
  canBecomeLost,
  confirmMissing,
  findMissingPhotos,
  isInvalidGrantResponse,
  planHealthBatch,
  planEmailSync,
  planLost,
  planVolumeAudit,
  planRecovery,
  isUniqueConstraintError,
  oldEnoughToAudit,
  pickConfirmCandidates,
  MAX_CONFIRMS_PER_ALBUM,
  volumesAfterCursor,
  MISSING_GRACE_MS,
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
  it('takes as many as the budget covers at the least a check costs', () => {
    const many = [
      cand({ userId: 'a', volumeCount: 20 }),
      cand({ userId: 'b', volumeCount: 1 }),
      cand({ userId: 'c', volumeCount: 4 }),
    ]
    expect(planHealthBatch(many, now, 4)).toEqual(['a', 'b'])
    expect(planHealthBatch(many, now, 1)).toEqual([])
    expect(planHealthBatch(many, now, 0)).toEqual([])
  })
  it('needs only the token refresh for a flamekeeper with no volumes', () => {
    expect(planHealthBatch([cand({ volumeCount: 0 })], now, 1)).toEqual(['a'])
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

describe('volumesAfterCursor', () => {
  it('sorts and resumes after the cursor', () => {
    expect(volumesAfterCursor(['c', 'a', 'b'], null)).toEqual(['a', 'b', 'c'])
    expect(volumesAfterCursor(['c', 'a', 'b'], 'a')).toEqual(['b', 'c'])
    expect(volumesAfterCursor(['a'], 'a')).toEqual([])
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

describe('planRecovery', () => {
  const album = (over = {}) => ({
    deletedAt: null,
    tombstoneReason: null,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
    pinned: false,
    ...over,
  })
  it('restores photos of a live album', () => {
    expect(planRecovery(album(), now)).toBe('restore')
  })
  it('restores a flamekeeper_lost tombstone before its expiry', () => {
    expect(
      planRecovery(
        album({ deletedAt: ago(10), tombstoneReason: 'flamekeeper_lost' }),
        now
      )
    ).toBe('restore')
  })
  it('abandons photos once the album has expired', () => {
    expect(planRecovery(album({ expiresAt: ago(1) }), now)).toBe('abandon')
    expect(
      planRecovery(
        album({
          deletedAt: ago(10),
          tombstoneReason: 'flamekeeper_lost',
          expiresAt: ago(1),
        }),
        now
      )
    ).toBe('abandon')
  })
  it('keeps pinned albums recoverable past their date', () => {
    expect(planRecovery(album({ expiresAt: ago(1), pinned: true }), now)).toBe(
      'restore'
    )
  })
  it('abandons albums removed for another reason', () => {
    for (const reason of ['expired', 'flamekeeper_left', 'no_space', null]) {
      expect(
        planRecovery(
          album({ deletedAt: ago(10), tombstoneReason: reason }),
          now
        )
      ).toBe('abandon')
    }
  })
})

describe('oldEnoughToAudit', () => {
  it('spares photos uploaded within the grace period', () => {
    expect(oldEnoughToAudit(ago(MISSING_GRACE_MS - 1), now)).toBe(false)
    expect(oldEnoughToAudit(ago(MISSING_GRACE_MS), now)).toBe(true)
  })
})

describe('planVolumeAudit', () => {
  const rows = [{ id: 'p1', driveFileId: 'f1' }]
  it('skips a volume with no folder id so photos are never called missing', () => {
    expect(planVolumeAudit(null, rows)).toBe('skip')
  })
  it('audits a volume with a folder id and rows', () => {
    expect(planVolumeAudit('sub1', rows)).toBe('audit')
  })
  it('skips when there are no rows', () => {
    expect(planVolumeAudit('sub1', [])).toBe('skip')
  })
})

describe('confirmMissing', () => {
  it('removes a row whose file is gone or trashed', () => {
    expect(confirmMissing('missing')).toBe('remove')
    expect(confirmMissing('trashed')).toBe('remove')
  })
  it('keeps a row whose file still exists, e.g. moved out of the folder', () => {
    expect(confirmMissing('exists')).toBe('keep')
  })
  it('keeps a row on any other error', () => {
    expect(confirmMissing('error')).toBe('keep')
  })
})

describe('pickConfirmCandidates', () => {
  const refs = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, driveFileId: `f${i}` }))

  it('returns everything when within the limit', () => {
    expect(
      pickConfirmCandidates(refs(3), 10, () => 0.5)
        .map((p) => p.id)
        .sort()
    ).toEqual(['p0', 'p1', 'p2'])
  })

  it('picks exactly the limit with no duplicates', () => {
    const picked = pickConfirmCandidates(
      refs(25),
      MAX_CONFIRMS_PER_ALBUM,
      () => 0.3
    )
    expect(picked).toHaveLength(MAX_CONFIRMS_PER_ALBUM)
    expect(new Set(picked.map((p) => p.id)).size).toBe(MAX_CONFIRMS_PER_ALBUM)
  })

  it('can reach candidates past the first ten', () => {
    const picked = pickConfirmCandidates(refs(25), 10, () => 0.99)
    expect(picked.some((p) => Number(p.id.slice(1)) >= 10)).toBe(true)
  })

  it('draws from the random source', () => {
    const low = pickConfirmCandidates(refs(25), 10, () => 0)
    const high = pickConfirmCandidates(refs(25), 10, () => 0.999)
    expect(low).not.toEqual(high)
  })

  it('does not mutate the input', () => {
    const input = refs(25)
    pickConfirmCandidates(input, 10, () => 0.1)
    expect(input).toEqual(refs(25))
  })
})
