import { describe, expect, it } from 'vitest'
import type { DrainFlamekeeper } from '@/lib/pool/drain'
import {
  graduationConfirmDue,
  graduationDrainStart,
  graduationPromptEmailDue,
  planDomainChange,
  planFlamekeeperEdit,
  planGraduation,
  type GraduationConfirmState,
} from '@/lib/pool/graduation'

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

const draining = (reason: DrainFlamekeeper['drainReason']) =>
  fk({ state: 'draining', drainReason: reason, drainingDeadline: IN_14_DAYS })

describe('graduationDrainStart', () => {
  it('is 60 days before the graduation date', () => {
    expect(graduationDrainStart('2027-01-01').toISOString()).toBe(
      '2026-11-02T00:00:00.000Z'
    )
  })
})

describe('planGraduation', () => {
  it('does nothing more than 60 days out', () => {
    expect(planGraduation(fk(), '2027-01-02', NOW)).toEqual({ kind: 'none' })
  })

  it('starts a full drain once within 60 days', () => {
    expect(planGraduation(fk(), '2026-12-31', NOW)).toEqual({
      kind: 'drain',
      state: 'draining',
      drainReason: 'graduation',
      drainingDeadline: IN_14_DAYS,
    })
  })

  it('drains a full flamekeeper and an overdue date too', () => {
    expect(planGraduation(fk({ state: 'full' }), '2026-06-01', NOW).kind).toBe(
      'drain'
    )
  })

  it('goes straight to drained when nothing is held', () => {
    expect(
      planGraduation(fk({ usedBytes: 0 }), '2026-12-01', NOW, false)
    ).toEqual({ kind: 'drained' })
  })

  it('widens a pledge drain', () => {
    expect(planGraduation(draining('pledge'), '2026-12-01', NOW).kind).toBe(
      'drain'
    )
  })

  it('keeps the deadline of an existing graduation or opt-out drain', () => {
    expect(planGraduation(draining('graduation'), '2026-12-01', NOW)).toEqual({
      kind: 'none',
    })
    expect(planGraduation(draining('opt_out'), '2026-12-01', NOW)).toEqual({
      kind: 'none',
    })
  })

  it('cancels a graduation drain when the date moves out of the window', () => {
    expect(planGraduation(draining('graduation'), '2028-06-01', NOW)).toEqual({
      kind: 'resume',
    })
  })

  it('ignores lost and drained flamekeepers', () => {
    expect(planGraduation(fk({ state: 'lost' }), '2026-12-01', NOW).kind).toBe(
      'none'
    )
    expect(
      planGraduation(fk({ state: 'drained' }), '2026-12-01', NOW).kind
    ).toBe('none')
  })
})

describe('planDomainChange', () => {
  it('ignores nu.edu.kz addresses', () => {
    expect(planDomainChange(fk(), 'a@nu.edu.kz', NOW)).toEqual({ kind: 'none' })
    expect(planDomainChange(fk(), 'A@NU.EDU.KZ', NOW)).toEqual({ kind: 'none' })
  })

  it('drains immediately on alumni', () => {
    expect(planDomainChange(fk(), 'a@alumni.nu.edu.kz', NOW)).toEqual({
      kind: 'drain',
      state: 'draining',
      drainReason: 'domain',
      drainingDeadline: IN_14_DAYS,
    })
  })

  it('goes straight to drained when nothing is held', () => {
    expect(planDomainChange(fk(), 'a@gmail.com', NOW, false)).toEqual({
      kind: 'drained',
    })
  })

  it('takes over a graduation or pledge drain, not an opt-out', () => {
    const kind = (reason: DrainFlamekeeper['drainReason']) =>
      planDomainChange(draining(reason), 'a@gmail.com', NOW).kind
    expect(kind('graduation')).toBe('drain')
    expect(kind('pledge')).toBe('drain')
    expect(kind('opt_out')).toBe('none')
    expect(kind('domain')).toBe('none')
  })

  it('leaves lost flamekeepers to the health check', () => {
    expect(
      planDomainChange(fk({ state: 'lost' }), 'a@gmail.com', NOW).kind
    ).toBe('none')
  })
})

describe('planFlamekeeperEdit', () => {
  it('uses the pledge plan when graduation is far off', () => {
    expect(
      planFlamekeeperEdit(
        fk(),
        { pledgedBytes: 2 * GB, graduationDate: '2030-05-01' },
        NOW
      ).kind
    ).toBe('drain')
  })

  it('prefers a graduation drain', () => {
    expect(
      planFlamekeeperEdit(
        fk(),
        { pledgedBytes: 2 * GB, graduationDate: '2026-12-01' },
        NOW
      )
    ).toMatchObject({ kind: 'drain', drainReason: 'graduation' })
  })

  it('resumes when a graduation drain is pushed out', () => {
    expect(
      planFlamekeeperEdit(
        draining('graduation'),
        { pledgedBytes: 10 * GB, graduationDate: '2030-05-01' },
        NOW
      ).kind
    ).toBe('resume')
  })

  it('switches to a pledge drain when pushed out but the pledge is too low', () => {
    expect(
      planFlamekeeperEdit(
        draining('graduation'),
        { pledgedBytes: 2 * GB, graduationDate: '2030-05-01' },
        NOW
      )
    ).toMatchObject({ kind: 'drain', drainReason: 'pledge' })
  })
})

describe('yearly confirmation', () => {
  const base: GraduationConfirmState = {
    state: 'active',
    createdAt: new Date('2025-10-01T00:00:00Z'),
    graduationConfirmedAt: null,
    graduationPromptSentAt: null,
  }

  it('is not due within a year of signup or confirmation', () => {
    expect(
      graduationConfirmDue({ ...base, createdAt: new Date('2026-03-01') }, NOW)
    ).toBe(false)
    expect(
      graduationConfirmDue(
        { ...base, graduationConfirmedAt: new Date('2026-06-01') },
        NOW
      )
    ).toBe(false)
  })

  it('is due a year after the last confirmation', () => {
    expect(graduationConfirmDue(base, NOW)).toBe(true)
  })

  it('is never due for drained or lost flamekeepers', () => {
    expect(graduationConfirmDue({ ...base, state: 'drained' }, NOW)).toBe(false)
    expect(graduationConfirmDue({ ...base, state: 'lost' }, NOW)).toBe(false)
  })

  it('emails once per cycle', () => {
    expect(graduationPromptEmailDue(base, NOW)).toBe(true)
    expect(
      graduationPromptEmailDue(
        { ...base, graduationPromptSentAt: new Date('2026-10-05') },
        NOW
      )
    ).toBe(false)
    expect(
      graduationPromptEmailDue(
        { ...base, graduationPromptSentAt: new Date('2025-10-05') },
        NOW
      )
    ).toBe(true)
  })

  it('does not email draining flamekeepers', () => {
    expect(graduationPromptEmailDue({ ...base, state: 'draining' }, NOW)).toBe(
      false
    )
  })
})
