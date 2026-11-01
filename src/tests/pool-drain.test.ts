import { describe, expect, it } from 'vitest'
import {
  drainAdminAlertDue,
  drainBytesLeft,
  drainReminderDue,
  isDrainOverdue,
  pickDeadlineDeletions,
  planDrainProgress,
  planOptOut,
  planPledgeChange,
  type DrainFlamekeeper,
} from '@/lib/pool/drain'
import { placeUpload, type PoolFlamekeeper } from '@/lib/pool/placement'

const GB = 1024 * 1024 * 1024
const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-01T10:00:00Z')
const IN_14_DAYS = new Date(NOW.getTime() + 14 * DAY)

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

function draining(
  reason: 'opt_out' | 'pledge',
  overrides: Partial<DrainFlamekeeper> = {}
): DrainFlamekeeper {
  return fk({
    state: 'draining',
    drainReason: reason,
    drainingDeadline: IN_14_DAYS,
    ...overrides,
  })
}

describe('planOptOut', () => {
  it('starts draining everything with a 14-day deadline', () => {
    expect(planOptOut(fk(), NOW)).toEqual({
      kind: 'drain',
      state: 'draining',
      drainReason: 'opt_out',
      drainingDeadline: IN_14_DAYS,
    })
  })

  it('also drains a full flamekeeper', () => {
    expect(planOptOut(fk({ state: 'full' }), NOW).kind).toBe('drain')
  })

  it('goes straight to drained when nothing is stored', () => {
    expect(planOptOut(fk({ usedBytes: 0 }), NOW, false)).toEqual({
      kind: 'drained',
    })
  })

  it('turns a lowered-pledge drain into a full drain with a fresh deadline', () => {
    const plan = planOptOut(
      draining('pledge', { drainingDeadline: new Date(NOW.getTime() + DAY) }),
      NOW
    )
    expect(plan).toEqual({
      kind: 'drain',
      state: 'draining',
      drainReason: 'opt_out',
      drainingDeadline: IN_14_DAYS,
    })
  })

  it('keeps the deadline when already opting out', () => {
    expect(planOptOut(draining('opt_out'), NOW)).toEqual({ kind: 'none' })
  })

  it('refuses lost and drained flamekeepers', () => {
    expect(planOptOut(fk({ state: 'lost' }), NOW).kind).toBe('refuse')
    expect(planOptOut(fk({ state: 'drained' }), NOW).kind).toBe('refuse')
  })
})

describe('planPledgeChange', () => {
  it('drains when the pledge drops below what is used', () => {
    expect(planPledgeChange(fk({ usedBytes: 6 * GB }), 5 * GB, NOW)).toEqual({
      kind: 'drain',
      state: 'draining',
      drainReason: 'pledge',
      drainingDeadline: IN_14_DAYS,
    })
  })

  it('does nothing when the pledge still covers what is used', () => {
    expect(planPledgeChange(fk({ usedBytes: 6 * GB }), 6 * GB, NOW)).toEqual({
      kind: 'none',
    })
  })

  it('drains a full flamekeeper whose pledge drops below use', () => {
    expect(
      planPledgeChange(fk({ state: 'full', usedBytes: 6 * GB }), 2 * GB, NOW)
        .kind
    ).toBe('drain')
  })

  it('resumes a full flamekeeper whose pledge is raised', () => {
    expect(
      planPledgeChange(fk({ state: 'full', usedBytes: 6 * GB }), 8 * GB, NOW)
    ).toEqual({ kind: 'resume' })
  })

  it('cancels a lowered-pledge drain when the pledge is raised again', () => {
    expect(
      planPledgeChange(
        draining('pledge', { pledgedBytes: 2 * GB, usedBytes: 4 * GB }),
        4 * GB,
        NOW
      )
    ).toEqual({ kind: 'resume' })
  })

  it('keeps the deadline while the pledge is still below use', () => {
    expect(
      planPledgeChange(
        draining('pledge', { pledgedBytes: 2 * GB, usedBytes: 4 * GB }),
        3 * GB,
        NOW
      )
    ).toEqual({ kind: 'none' })
  })

  it('never cancels an opt-out', () => {
    expect(planPledgeChange(draining('opt_out'), 100 * GB, NOW)).toEqual({
      kind: 'none',
    })
  })
})

describe('drainBytesLeft', () => {
  it('is everything stored when opting out', () => {
    expect(drainBytesLeft(draining('opt_out', { usedBytes: 3 * GB }))).toBe(
      3 * GB
    )
  })

  it('is only the excess over a lowered pledge', () => {
    expect(
      drainBytesLeft(
        draining('pledge', { pledgedBytes: 2 * GB, usedBytes: 5 * GB })
      )
    ).toBe(3 * GB)
  })

  it('is zero when not draining', () => {
    expect(drainBytesLeft(fk())).toBe(0)
  })
})

describe('planDrainProgress', () => {
  it('opt-out becomes drained once no photos are left', () => {
    expect(planDrainProgress(draining('opt_out'), false)).toEqual({
      kind: 'drained',
    })
    expect(planDrainProgress(draining('opt_out'), true)).toEqual({
      kind: 'none',
    })
  })

  it('lowered pledge returns to active once use fits the pledge', () => {
    expect(
      planDrainProgress(
        draining('pledge', { pledgedBytes: 2 * GB, usedBytes: 2 * GB }),
        true
      )
    ).toEqual({ kind: 'resume' })
    expect(
      planDrainProgress(
        draining('pledge', { pledgedBytes: 2 * GB, usedBytes: 3 * GB }),
        true
      )
    ).toEqual({ kind: 'none' })
  })

  it('ignores flamekeepers that are not draining', () => {
    expect(planDrainProgress(fk(), false)).toEqual({ kind: 'none' })
  })
})

describe('drain deadline', () => {
  it('is overdue from 14 days after draining started', () => {
    const started = planOptOut(fk(), NOW)
    if (started.kind !== 'drain') throw new Error('expected drain')
    const fkDraining = draining('opt_out', {
      drainingDeadline: started.drainingDeadline,
    })
    expect(isDrainOverdue(fkDraining, new Date(NOW.getTime() + 13 * DAY))).toBe(
      false
    )
    expect(isDrainOverdue(fkDraining, new Date(NOW.getTime() + 14 * DAY))).toBe(
      true
    )
  })

  it('is never overdue when not draining', () => {
    expect(
      isDrainOverdue(
        fk({ drainingDeadline: NOW }),
        new Date(NOW.getTime() + DAY)
      )
    ).toBe(false)
  })

  it('sends one reminder in the last 3 days', () => {
    const fkDraining = draining('opt_out')
    expect(
      drainReminderDue(fkDraining, new Date(NOW.getTime() + 10 * DAY))
    ).toBe(false)
    expect(
      drainReminderDue(fkDraining, new Date(NOW.getTime() + 12 * DAY))
    ).toBe(true)
    expect(
      drainReminderDue(
        draining('opt_out', { drainReminderSentAt: NOW }),
        new Date(NOW.getTime() + 12 * DAY)
      )
    ).toBe(false)
    expect(
      drainReminderDue(fkDraining, new Date(NOW.getTime() + 15 * DAY))
    ).toBe(false)
  })
})

describe('pickDeadlineDeletions', () => {
  const photos = [
    { id: 'a', bytes: 1 * GB },
    { id: 'b', bytes: 3 * GB },
    { id: 'c', bytes: 2 * GB },
  ]

  it('deletes every unmoved photo of an opt-out', () => {
    expect(
      pickDeadlineDeletions(draining('opt_out'), photos).map((p) => p.id)
    ).toEqual(['a', 'b', 'c'])
  })

  it('deletes only enough, largest first, to fit a lowered pledge', () => {
    const fkDraining = draining('pledge', {
      pledgedBytes: 2 * GB,
      usedBytes: 6 * GB,
    })
    expect(pickDeadlineDeletions(fkDraining, photos).map((p) => p.id)).toEqual([
      'b',
      'c',
    ])
  })
})

describe('relay destination', () => {
  function pool(overrides: Partial<PoolFlamekeeper>): PoolFlamekeeper {
    return {
      userId: 'x',
      state: 'active',
      pledgedBytes: 10 * GB,
      usedBytes: 0,
      reservedBytes: 0,
      driveUsageBytes: 0,
      ...overrides,
    }
  }

  it('picks the active flamekeeper with the most usable space, never the source', () => {
    const fks = [
      pool({ userId: 'src', pledgedBytes: 100 * GB }),
      pool({ userId: 'small', pledgedBytes: 2 * GB }),
      pool({ userId: 'big', pledgedBytes: 8 * GB }),
      pool({ userId: 'drain', state: 'draining', pledgedBytes: 50 * GB }),
    ]
    expect(
      placeUpload(fks, { bytes: GB, capBytes: 20 * GB, exclude: ['src'] })
    ).toEqual({ kind: 'placed', userId: 'big' })
  })

  it('reports no space when no one else can take the photo', () => {
    expect(
      placeUpload([pool({ userId: 'src' })], {
        bytes: GB,
        capBytes: 20 * GB,
        exclude: ['src'],
      })
    ).toEqual({ kind: 'no_space' })
  })
})

describe('drainAdminAlertDue', () => {
  const alert = (over = {}) => ({
    state: 'draining' as const,
    drainingDeadline: IN_14_DAYS,
    drainAdminStartedAt: null,
    drainAdminRemindedAt: null,
    ...over,
  })
  it('announces a new drain first', () => {
    expect(drainAdminAlertDue(alert(), NOW)).toBe('started')
  })
  it('stays quiet in between', () => {
    expect(
      drainAdminAlertDue(alert({ drainAdminStartedAt: NOW }), NOW)
    ).toBeNull()
  })
  it('reminds once in the last 3 days', () => {
    const late = new Date(IN_14_DAYS.getTime() - 3 * DAY)
    const started = { drainAdminStartedAt: NOW }
    expect(drainAdminAlertDue(alert(started), late)).toBe('reminder')
    expect(
      drainAdminAlertDue(
        alert({ ...started, drainAdminRemindedAt: late }),
        late
      )
    ).toBeNull()
  })
  it('sends nothing after the deadline or when not draining', () => {
    const started = { drainAdminStartedAt: NOW }
    expect(
      drainAdminAlertDue(alert(started), new Date(IN_14_DAYS.getTime() + 1))
    ).toBeNull()
    expect(drainAdminAlertDue(alert({ state: 'active' }), NOW)).toBeNull()
    expect(
      drainAdminAlertDue(alert({ drainingDeadline: null }), NOW)
    ).toBeNull()
  })
})
